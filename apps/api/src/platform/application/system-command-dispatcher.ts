import { Inject, Injectable } from "@nestjs/common";
import { Command, CommandBus } from "@nestjs/cqrs";
import { ApiErrorCodes, JsonValueSchema, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { CLOCK, type Clock } from "./clock.port";
import { DomainError } from "../domain/errors/domain-error";
import { COMMAND_AUDIT, SystemCommandAuditEntrySchema, type CommandAuditPort, type SystemCommandOrigin } from "./ports/command-audit.port";
import { CORRELATION_SCOPE, type CorrelationScopePort } from "./ports/correlation-scope.port";
import { OPERATIONAL_ALERTS, type OperationalAlertPort } from "./ports/operational-alert.port";
import { SystemOperationNameSchema } from "./system-operation-names";

const CommandActorSchema = z.object({
	kind: z.literal("system"),
	operation: SystemOperationNameSchema,
	tenantId: z.string().min(1).nullable(),
	actorUserId: z.string().min(1).nullable(),
});

const CommandWithActorSchema = z.looseObject({
	actor: CommandActorSchema,
});

/** What the audit row stores when a command's fields cannot be written as JSON (a cycle, say). */
export const UNSERIALIZABLE_COMMAND_INPUT: JsonValue = { unserializable: true };

type Execution<TResult> = { readonly ok: true; readonly result: TResult } | { readonly ok: false; readonly error: Error };

/**
 * Runs one system command (job, cron, CLI, bootstrap, consumer) through the
 * command bus and writes its audit row. The command and the audit row share
 * one correlation id, which every transaction the handler opens stamps too.
 *
 * A failed command rethrows its own error. A command that succeeded but whose
 * audit row could not be written is NOT failed: its work already committed,
 * and rethrowing would make the queue retry it. The dispatcher raises an
 * alert-level event instead and returns the result.
 */
@Injectable()
export class SystemCommandDispatcher {
	public constructor(
		@Inject(CommandBus) private readonly commandBus: Pick<CommandBus, "execute">,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(COMMAND_AUDIT) private readonly audit: CommandAuditPort,
		@Inject(CORRELATION_SCOPE) private readonly correlation: CorrelationScopePort,
		@Inject(OPERATIONAL_ALERTS) private readonly alerts: OperationalAlertPort,
	) {}

	public async dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult> {
		return this.correlation.run(async (correlationId: string): Promise<TResult> => {
			const startedAt = this.clock.now();
			const execution: Execution<TResult> = await this.execute(command);
			const finishedAt = this.clock.now();
			try {
				await this.audit.record(
					SystemCommandAuditEntrySchema.parse({
						...this.facts(command, origin),
						correlationId,
						outcome: execution.ok ? "success" : "failure",
						errorCode: execution.ok ? null : execution.error instanceof DomainError ? execution.error.code : ApiErrorCodes.INTERNAL_ERROR,
						error: execution.ok ? null : execution.error,
						durationMs: finishedAt - startedAt,
						occurredAt: finishedAt,
					}),
				);
			} catch (auditError) {
				this.alerts.raise({
					event: "system_command.audit_write_failed",
					message: "A system command ran but its audit row was not written.",
					facts: {
						commandName: command.constructor.name,
						originKind: origin.kind,
						originName: origin.name,
						correlationId,
						commandSucceeded: execution.ok,
						auditError: auditError instanceof Error ? auditError.message : "non-error thrown",
					},
				});
			}
			if (!execution.ok) {
				throw execution.error;
			}
			return execution.result;
		});
	}

	private async execute<TResult>(command: Command<TResult>): Promise<Execution<TResult>> {
		try {
			const result = await this.commandBus.execute(command);
			return { ok: true, result };
		} catch (error) {
			if (error instanceof Error) {
				return { ok: false, error };
			}
			return { ok: false, error: new Error("system command failed") };
		}
	}

	private facts<TResult>(
		command: Command<TResult>,
		origin: SystemCommandOrigin,
	): {
		readonly originKind: SystemCommandOrigin["kind"];
		readonly originName: string;
		readonly commandName: string;
		readonly input: JsonValue;
		readonly operation: string | null;
		readonly tenantId: string | null;
		readonly actorUserId: string | null;
	} {
		const actor = CommandWithActorSchema.safeParse(command);
		return {
			originKind: origin.kind,
			originName: origin.name,
			commandName: command.constructor.name,
			input: commandInput(command),
			operation: actor.success ? actor.data.actor.operation : null,
			tenantId: actor.success ? actor.data.actor.tenantId : null,
			actorUserId: actor.success ? actor.data.actor.actorUserId : null,
		};
	}
}

/** JSON writes a `bigint` as its decimal string instead of throwing. */
function bigintAsString(_key: string, value: JsonReplacerValue): JsonReplacerValue {
	const big = z.bigint().safeParse(value);
	return big.success ? big.data.toString() : value;
}

/** A value `JSON.stringify` hands its replacer. */
type JsonReplacerValue = object | string | number | boolean | bigint | symbol | null | undefined;

/**
 * JSON of the command's own fields; the audit adapter redacts secrets before the
 * row is stored. Never throws: a `bigint` becomes its decimal string, and a
 * value JSON cannot represent (a cycle) is recorded as {@link UNSERIALIZABLE_COMMAND_INPUT},
 * because a command must not fail on its own audit description.
 */
export function commandInput<TResult>(command: Command<TResult>): JsonValue {
	let text: string;
	try {
		text = JSON.stringify(command, bigintAsString);
	} catch {
		return UNSERIALIZABLE_COMMAND_INPUT;
	}
	// The `JSON.parse` result is validated at once, so its untyped value never escapes.
	const parsed = JsonValueSchema.safeParse(JSON.parse(text));
	return parsed.success ? parsed.data : UNSERIALIZABLE_COMMAND_INPUT;
}
