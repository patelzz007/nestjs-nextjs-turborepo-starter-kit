import type { AccountErasureStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** An erasure request as stored. */
export interface AccountErasureRecord {
	readonly id: string;
	readonly userId: string;
	readonly status: AccountErasureStatus;
	readonly requestedByUserId: string;
	readonly reason: string | null;
	readonly requestedAt: number;
	readonly scheduledFor: number;
	readonly cancelledAt: number | null;
	readonly cancelledByUserId: string | null;
	readonly completedAt: number | null;
}

/** A request to record. */
export type NewAccountErasure = Pick<AccountErasureRecord, "id" | "userId" | "requestedByUserId" | "reason" | "requestedAt" | "scheduledFor">;

/**
 * The erasure requests (`AccountErasure`). Reads of one's own request run under the person's RLS context;
 * every write runs under a privacy system operation.
 */
export interface AccountErasureStore {
	/** The person's own open request, or else their most recent one, read as the person. */
	latestOwn(person: ActorContext, userId: string): Promise<AccountErasureRecord | null>;
	/** The open request for `userId`, or else their most recent one, read as a system operation (support's view). */
	latestOf(actor: ActorContext, userId: string): Promise<AccountErasureRecord | null>;
	/** The open (PENDING) request for `userId`, read as a system operation. */
	findOpen(actor: ActorContext, userId: string): Promise<AccountErasureRecord | null>;
	create(actor: ActorContext, request: NewAccountErasure): Promise<AccountErasureRecord>;
	cancel(actor: ActorContext, id: string, cancelledByUserId: string, at: number): Promise<AccountErasureRecord>;
	/** PENDING requests whose grace period has ended, oldest first. */
	due(actor: ActorContext, now: number, limit: number): Promise<readonly AccountErasureRecord[]>;
	/** Masks the person in every kept audit and security record (`app_mask_erased_person`); returns rows changed. */
	maskInKeptRecords(actor: ActorContext, userId: string, email: string): Promise<number>;
	complete(actor: ActorContext, id: string, at: number): Promise<AccountErasureRecord>;
}

export const ACCOUNT_ERASURE_STORE = Symbol("ACCOUNT_ERASURE_STORE");
export const ACCOUNT_ERASURE_SERVICE = Symbol("ACCOUNT_ERASURE_SERVICE");
