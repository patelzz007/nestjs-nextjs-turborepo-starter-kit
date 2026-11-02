/**
 * How changes are grouped into one background entry of the audit trail: by the request (or job) that made
 * them, else by their transaction. Shared by the timeline's SQL and the `data_change_group_track` trigger
 * (prisma/rls/data-change-capture.ts), so the two can never disagree on a group's key.
 */

/** Prefix of the group key of changes with no correlation id: `tx:<transaction id>`. */
export const TRANSACTION_GROUP_PREFIX = "tx:";

/** The group a change belongs to on the timeline: its correlation id, else its transaction. */
export function dataChangeGroupKey(change: { readonly correlationId: string | null; readonly transactionId: bigint }): string {
	return change.correlationId ?? `${TRANSACTION_GROUP_PREFIX}${change.transactionId.toString()}`;
}
