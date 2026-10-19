import { z } from "zod";

import { EpochMsSchema, JsonValueSchema } from "@workspace/shared";

import { SystemOriginSchema } from "../actor-context";

export const SystemCommandOriginSchema = z.object({
	kind: SystemOriginSchema,
	name: z.string().min(1),
});

export type SystemCommandOrigin = z.output<typeof SystemCommandOriginSchema>;

export const SystemCommandOutcomeSchema = z.enum(["success", "failure"]);

export type SystemCommandOutcome = z.output<typeof SystemCommandOutcomeSchema>;

/** One system command execution, after secrets and personal data have been removed from `input`. */
export const SystemCommandAuditEntrySchema = z.object({
	originKind: SystemOriginSchema,
	originName: z.string().min(1),
	commandName: z.string().min(1),
	input: JsonValueSchema,
	operation: z.string().min(1).nullable(),
	organizationId: z.string().min(1).nullable(),
	/** The human the system actor runs on behalf of; null for background work with no user. */
	actorUserId: z.string().min(1).nullable(),
	/** The id every transaction of this command stamped as `app.correlation_id`. */
	correlationId: z.string().min(1),
	outcome: SystemCommandOutcomeSchema,
	errorCode: z.string().min(1).nullable(),
	durationMs: z.number().int().nonnegative(),
	occurredAt: EpochMsSchema,
});

export type SystemCommandAuditEntry = z.output<typeof SystemCommandAuditEntrySchema>;

export interface CommandAuditPort {
	record(entry: SystemCommandAuditEntry): Promise<void>;
}

export const COMMAND_AUDIT = Symbol("COMMAND_AUDIT");
