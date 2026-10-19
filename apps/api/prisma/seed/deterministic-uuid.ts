import { createHash } from "node:crypto";

import { rowIdFrom } from "@workspace/shared";

/**
 * The creation time every deterministic seed id carries (2026-01-01T00:00:00Z). Row ids are UUID v7, whose first
 * 48 bits are a creation time; a FIXED time keeps a seeded row's id identical on every re-seed.
 */
export const SEED_ROW_ID_EPOCH_MS = 1_767_225_600_000;

/**
 * A stable UUID v7 for a seeded row, from a namespace + key: the same row gets the same id on every re-seed
 * (idempotent upserts by id), and it has the same shape as every id the app mints (`newRowId`).
 */
export function deterministicUuid(namespace: string, key: string): string {
	return rowIdFrom(SEED_ROW_ID_EPOCH_MS, createHash("sha256").update(`${namespace}:${key}`).digest());
}
