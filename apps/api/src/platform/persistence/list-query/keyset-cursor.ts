// ============================================
// platform/persistence/list-query/keyset-cursor.ts - opaque keyset cursors
// ============================================
// Cursor pagination follows a resource's DEFAULT order (e.g. `createdAt desc,
// id desc`). The cursor encodes the last row's position in that order — the
// default-sort column value plus the `id` tie-breaker — as base64url JSON, and
// decodes it back into a typed "rows after this position" `where` fragment.
//
// Each resource declares its keyset explicitly (schema + read + after), so the
// comparison direction is visible in the repository and a tampered or stale
// cursor is rejected by the position schema instead of reaching Prisma.

import type { DataValue } from "@workspace/shared";
import { z } from "zod";

/** Encodes rows into cursors and decodes cursors into "after this position" conditions. */
export interface ListKeyset<TRow, TWhere> {
	/** Opaque cursor for the position right after `row`. */
	readonly encode: (row: TRow) => string;
	/** The `where` fragment selecting rows after the cursor's position, or `null` when the cursor is malformed. */
	readonly decode: (cursor: string) => TWhere | null;
}

export interface KeysetDefinition<TRow, TWhere, TPosition extends DataValue> {
	/** Validates a decoded position — a stale or tampered cursor fails here. */
	readonly position: z.ZodType<TPosition>;
	/** Reads the position of a row in the default order. */
	readonly read: (row: TRow) => TPosition;
	/** Rows strictly after `position` in the default order (direction-aware: `lt` for desc, `gt` for asc). */
	readonly after: (position: TPosition) => TWhere;
}

const CURSOR_ENCODING = "base64url";

/** Builds a {@link ListKeyset} from an explicit position schema + reader + comparison. */
export function defineKeyset<TRow, TWhere, TPosition extends DataValue>(definition: KeysetDefinition<TRow, TWhere, TPosition>): ListKeyset<TRow, TWhere> {
	return {
		encode: (row: TRow): string => Buffer.from(JSON.stringify(definition.read(row)), "utf-8").toString(CURSOR_ENCODING),
		decode: (cursor: string): TWhere | null => {
			let decoded: string;
			try {
				decoded = Buffer.from(cursor, CURSOR_ENCODING).toString("utf-8");
			} catch {
				return null;
			}
			try {
				// Validated immediately by the resource's position schema — a stale or tampered cursor fails here.
				const position = definition.position.safeParse(JSON.parse(decoded));
				return position.success ? definition.after(position.data) : null;
			} catch {
				return null;
			}
		},
	};
}

// ── Timestamp + id keysets (the common "newest first" default order) ───────

/** Upper bound for a string id inside a cursor (UUIDs are 36 characters). */
const KEYSET_ID_MAX_LENGTH = 64;

/** Position of a row in a `<timestamp> <dir>, id <dir>` default order. */
export const TimestampIdPositionSchema = z.object({ at: z.number().int().nonnegative(), id: z.string().min(1).max(KEYSET_ID_MAX_LENGTH) }).strict();
export type TimestampIdPosition = z.output<typeof TimestampIdPositionSchema>;

/**
 * Keyset for the very common "epoch-ms timestamp + string id" default order
 * (`createdAt desc, id desc`). The repository still writes the comparison
 * itself — column names stay explicit and typed:
 *
 *   timestampIdKeyset<UserRow, Prisma.UserWhereInput>(
 *     (row) => ({ at: Number(row.createdAt), id: row.id }),
 *     ({ at, id }) => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
 *   )
 */
export function timestampIdKeyset<TRow, TWhere>(read: (row: TRow) => TimestampIdPosition, after: (position: TimestampIdPosition) => TWhere): ListKeyset<TRow, TWhere> {
	return defineKeyset({ position: TimestampIdPositionSchema, read, after });
}
