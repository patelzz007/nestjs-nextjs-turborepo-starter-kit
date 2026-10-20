/**
 * The base fields every Prisma row carries (the `BaseModel` of prisma/schema.prisma) besides `id` and the times, as
 * a TEST-ONLY row has them: live, and written by no session actor. Spread it FIRST into a row literal, so the
 * fields the test cares about override it.
 */
export interface BaseRowFields {
	readonly createdBy: string | null;
	readonly updatedBy: string | null;
	readonly isDeleted: boolean;
	readonly deletedAt: bigint | null;
	readonly deletedBy: string | null;
}

export const LIVE_ROW_FIELDS: BaseRowFields = { createdBy: null, updatedBy: null, isDeleted: false, deletedAt: null, deletedBy: null };
