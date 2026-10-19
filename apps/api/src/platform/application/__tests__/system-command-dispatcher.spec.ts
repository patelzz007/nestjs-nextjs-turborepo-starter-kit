import { Command } from "@nestjs/cqrs";
import { epochMs, LIST_SLOT_INDEX, type EpochMs } from "@workspace/shared";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { systemActor, type ActorContext } from "../actor-context";
import type { Clock } from "../clock.port";
import { AuthorizationDeniedError } from "../../domain/errors/authorization-denied.error";
import type { CommandAuditPort, SystemCommandAuditEntry, SystemCommandOrigin } from "../ports/command-audit.port";
import type { CorrelationScopePort } from "../ports/correlation-scope.port";
import type { OperationalAlert, OperationalAlertPort } from "../ports/operational-alert.port";
import { commandInput, SystemCommandDispatcher, UNSERIALIZABLE_COMMAND_INPUT } from "../system-command-dispatcher";

const STARTED_AT: EpochMs = epochMs(1_700_000_000_000);
const FINISHED_AT: EpochMs = epochMs(1_700_000_000_250);
const ORIGIN: SystemCommandOrigin = { kind: "job", name: "rewards.auto-publish" };
const CORRELATION_ID = "system-command-correlation";
const ACTING_USER_ID = "user-on-whose-behalf";

class StepClock implements Clock {
	private first = true;

	public constructor(
		private readonly start: EpochMs,
		private readonly end: EpochMs,
	) {}

	public now(): EpochMs {
		if (this.first) {
			this.first = false;
			return this.start;
		}
		return this.end;
	}
}

/** Records entries; `failing` makes every write reject, like a database outage on the audit table. */
class RecordingAudit implements CommandAuditPort {
	public readonly entries: SystemCommandAuditEntry[] = [];

	public constructor(private readonly failing = false) {}

	public record(entry: SystemCommandAuditEntry): Promise<void> {
		if (this.failing) {
			return Promise.reject(new Error("audit_logs is unavailable"));
		}
		this.entries.push(entry);
		return Promise.resolve();
	}
}

/** Opens one fixed id and records which ids the work ran under. */
class FixedCorrelationScope implements CorrelationScopePort {
	public readonly opened: string[] = [];

	public run<TResult>(work: (correlationId: string) => Promise<TResult>): Promise<TResult> {
		this.opened.push(CORRELATION_ID);
		return work(CORRELATION_ID);
	}
}

class RecordingAlerts implements OperationalAlertPort {
	public readonly alerts: OperationalAlert[] = [];

	public raise(alert: OperationalAlert): void {
		this.alerts.push(alert);
	}
}

/** Resolves with `result` or rejects with `failure`, counting executions. */
class RecordingBus {
	public executions = 0;

	public constructor(private readonly failure: Error | null) {}

	public execute<TResult>(): Promise<TResult> {
		this.executions += 1;
		if (this.failure !== null) {
			return Promise.reject(this.failure);
		}
		return Promise.resolve(z.custom<TResult>(() => true).parse("committed"));
	}
}

class ResetPasswordCommand extends Command<string> {
	public constructor(
		public readonly password: string,
		public readonly actor: ActorContext,
	) {
		super();
	}
}

class BigIntCommand extends Command<string> {
	public constructor(public readonly amountMinor: bigint) {
		super();
	}
}

class CyclicCommand extends Command<string> {
	public self: CyclicCommand | null = null;
}

interface Harness {
	readonly dispatcher: SystemCommandDispatcher;
	readonly audit: RecordingAudit;
	readonly alerts: RecordingAlerts;
	readonly bus: RecordingBus;
	readonly correlation: FixedCorrelationScope;
}

function harness({ failure = null, auditFails = false }: { readonly failure?: Error | null; readonly auditFails?: boolean } = {}): Harness {
	const audit = new RecordingAudit(auditFails);
	const alerts = new RecordingAlerts();
	const bus = new RecordingBus(failure);
	const correlation = new FixedCorrelationScope();
	return { dispatcher: new SystemCommandDispatcher(bus, new StepClock(STARTED_AT, FINISHED_AT), audit, correlation, alerts), audit, alerts, bus, correlation };
}

describe("SystemCommandDispatcher", () => {
	it("writes one success entry with the command, the system actor, its acting user and the scope's correlation id", async () => {
		const { dispatcher, audit, correlation } = harness();
		const actor = systemActor("outbox.enqueue", "job", "org-1", "Auto publish", ACTING_USER_ID);

		await expect(dispatcher.dispatch(new ResetPasswordCommand("s3cret", actor), ORIGIN)).resolves.toBe("committed");

		expect(correlation.opened).toEqual([CORRELATION_ID]);
		expect(audit.entries).toHaveLength(1);
		expect(audit.entries[LIST_SLOT_INDEX.first]).toMatchObject({
			originKind: "job",
			originName: "rewards.auto-publish",
			commandName: "ResetPasswordCommand",
			operation: "outbox.enqueue",
			organizationId: "org-1",
			actorUserId: ACTING_USER_ID,
			correlationId: CORRELATION_ID,
			outcome: "success",
			errorCode: null,
			durationMs: 250,
			occurredAt: FINISHED_AT,
			input: {
				password: "s3cret",
				actor: { kind: "system", operation: "outbox.enqueue", organizationId: "org-1", origin: "job", actorUserId: ACTING_USER_ID, reason: "Auto publish" },
			},
		});
	});

	it("writes one failure entry and rethrows a domain error with its code", async () => {
		const denied = new AuthorizationDeniedError("publish", "Reward");
		const { dispatcher, audit } = harness({ failure: denied });

		await expect(dispatcher.dispatch(new ResetPasswordCommand("s3cret", systemActor("outbox.enqueue", "job", null, "Auto publish", null)), ORIGIN)).rejects.toBe(denied);

		expect(audit.entries).toHaveLength(1);
		expect(audit.entries[LIST_SLOT_INDEX.first]?.outcome).toBe("failure");
		expect(audit.entries[LIST_SLOT_INDEX.first]?.errorCode).toBe("PERMISSION_DENIED");
		expect(audit.entries[LIST_SLOT_INDEX.first]?.actorUserId).toBeNull();
	});

	it("records INTERNAL_ERROR for a non-domain failure and still rethrows it", async () => {
		const crash = new Error("broker down");
		const { dispatcher, audit } = harness({ failure: crash });

		await expect(dispatcher.dispatch(new ResetPasswordCommand("s3cret", systemActor("outbox.enqueue", "cron", null, "Tick", null)), ORIGIN)).rejects.toBe(crash);

		expect(audit.entries[LIST_SLOT_INDEX.first]?.errorCode).toBe("INTERNAL_ERROR");
	});

	it("returns a committed command's result and raises an alert when the audit write fails, so the queue does not retry it", async () => {
		const { dispatcher, alerts, bus } = harness({ auditFails: true });

		await expect(dispatcher.dispatch(new ResetPasswordCommand("s3cret", systemActor("outbox.enqueue", "job", null, "Auto publish", null)), ORIGIN)).resolves.toBe("committed");

		expect(bus.executions).toBe(1);
		expect(alerts.alerts).toHaveLength(1);
		expect(alerts.alerts[LIST_SLOT_INDEX.first]).toMatchObject({
			event: "system_command.audit_write_failed",
			facts: { commandName: "ResetPasswordCommand", originKind: "job", originName: "rewards.auto-publish", correlationId: CORRELATION_ID, commandSucceeded: true },
		});
	});

	it("rethrows the command's own failure, not the audit failure, and still raises the alert", async () => {
		const crash = new Error("broker down");
		const { dispatcher, alerts } = harness({ failure: crash, auditFails: true });

		await expect(dispatcher.dispatch(new ResetPasswordCommand("s3cret", systemActor("outbox.enqueue", "job", null, "Auto publish", null)), ORIGIN)).rejects.toBe(crash);

		expect(alerts.alerts[LIST_SLOT_INDEX.first]?.facts.commandSucceeded).toBe(false);
	});

	it("audits a command carrying a bigint instead of failing it", async () => {
		const { dispatcher, audit } = harness();

		await expect(dispatcher.dispatch(new BigIntCommand(12_345_678_901_234_567_890n), ORIGIN)).resolves.toBe("committed");

		expect(audit.entries[LIST_SLOT_INDEX.first]?.input).toEqual({ amountMinor: "12345678901234567890" });
		expect(audit.entries[LIST_SLOT_INDEX.first]?.operation).toBeNull();
	});
});

describe("commandInput", () => {
	it("writes a bigint as its decimal string", () => {
		expect(commandInput(new BigIntCommand(42n))).toEqual({ amountMinor: "42" });
	});

	it("records a cyclic command as unserializable instead of throwing", () => {
		const command = new CyclicCommand();
		command.self = command;

		expect(commandInput(command)).toEqual(UNSERIALIZABLE_COMMAND_INPUT);
	});
});
