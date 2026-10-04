import { randomBytes } from "node:crypto";

import type { Prisma, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { requireRow } from "./require-row";

// ---------------------------------------------------------------------------
// Personal API keys in their later lifecycle states (development scenario).
//
// `createApiKeys` / `createApiKeyUsageLogs` seed live keys and their traffic.
// This module completes the picture so every column holds real data:
//
//   - usage roll-up: each seeded key's `last_used_at` / `total_requests` are
//     derived from its own `api_key_usage_logs` rows (the newest call and the
//     call count), so the key list and its usage history agree;
//   - a revoked key: Bob's old laptop script key, used three times, then
//     deactivated and soft-deleted — its usage rows soft-deleted with it at the
//     same instant (`is_deleted` / `deleted_at` on both tables).
//
// The revoked key's raw secret is random and discarded (only the bcrypt hash
// is stored, like every seeded key): the row can never authenticate.
//
// Idempotent: the development scenario deletes the seed accounts' keys and
// usage rows first (cleanVolatileSeedRows) and this module re-creates the same
// rows with the same deterministic ids, so a re-run converges to one copy.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.api-key-lifecycle";
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** bcrypt cost for seeded key hashes (matches `createApiKeys`). */
const SEED_BCRYPT_ROUNDS = 10;
/** Random bytes behind the discarded secret of the revoked key. */
const REVOKED_KEY_SECRET_BYTES = 24;
/** Length of the visible `key_prefix` (`sk_live_` + 4 chars, as `generateSeedApiKey` produces). */
const KEY_PREFIX_LENGTH = 12;

export const REVOKED_API_KEY_OWNER_EMAIL = "bob.smith@example.com";
export const REVOKED_API_KEY_ID: string = deterministicUuid(NAMESPACE, "bob-old-laptop-script");

/** Fixed instants (deterministic seed data): created 2026-05-20T09:15Z, revoked and soft-deleted 2026-09-12T16:40Z. */
export const REVOKED_KEY_CREATED_AT_MS = 1_779_268_500_000;
export const REVOKED_KEY_DELETED_AT_MS = 1_789_231_200_000;

/** The revoked key's real traffic before it was retired (days before deletion → request). */
const REVOKED_KEY_USAGE: readonly {
	readonly key: string;
	readonly daysBeforeDeletion: number;
	readonly endpoint: string;
	readonly method: string;
	readonly statusCode: number;
	readonly responseTimeMs: number;
}[] = [
	{ key: "export-urls", daysBeforeDeletion: 64, endpoint: "/api/v1/urls", method: "GET", statusCode: 200, responseTimeMs: 84 },
	{ key: "create-url", daysBeforeDeletion: 40, endpoint: "/api/v1/urls", method: "POST", statusCode: 201, responseTimeMs: 132 },
	{ key: "after-rotation", daysBeforeDeletion: 2, endpoint: "/api/v1/urls", method: "GET", statusCode: 401, responseTimeMs: 19 },
];
const REVOKED_KEY_IP = "203.0.113.48";
const REVOKED_KEY_USER_AGENT = "python-requests/2.31.0";

export interface RevokedApiKeySeed {
	readonly key: Prisma.ApiKeyUncheckedCreateInput;
	readonly usageLogs: readonly Prisma.ApiKeyUsageLogUncheckedCreateInput[];
}

/** The revoked key and its (equally soft-deleted) usage rows. */
export function buildRevokedApiKeySeed(input: { readonly userId: string; readonly keyHash: string; readonly keyPrefix: string }): RevokedApiKeySeed {
	const createdAt = REVOKED_KEY_CREATED_AT_MS;
	const deletedAt = REVOKED_KEY_DELETED_AT_MS;
	const usageLogs = REVOKED_KEY_USAGE.map((usage, index): Prisma.ApiKeyUsageLogUncheckedCreateInput => ({
		id: deterministicUuid(NAMESPACE, `usage:${usage.key}`),
		apiKeyId: REVOKED_API_KEY_ID,
		endpoint: usage.endpoint,
		method: usage.method,
		statusCode: usage.statusCode,
		ipAddress: REVOKED_KEY_IP,
		userAgent: REVOKED_KEY_USER_AGENT,
		responseTimeMs: usage.responseTimeMs,
		createdAt: deletedAt - usage.daysBeforeDeletion * MS_PER_DAY + index * MS_PER_MINUTE,
		updatedAt: deletedAt,
		isDeleted: true,
		deletedAt,
	}));
	const lastUsedAt = Math.max(...usageLogs.map((log) => Number(log.createdAt)));
	return {
		key: {
			id: REVOKED_API_KEY_ID,
			userId: input.userId,
			name: "Bob — Old Laptop Script (revoked)",
			keyHash: input.keyHash,
			keyPrefix: input.keyPrefix,
			scopes: ["read", "write"],
			rateLimitTier: "standard",
			totalRequests: usageLogs.length,
			lastUsedAt,
			isActive: false,
			isDeleted: true,
			deletedAt,
			createdAt,
			updatedAt: deletedAt,
		},
		usageLogs,
	};
}

export interface ApiKeyLifecycleSummary {
	readonly keysRolledUp: number;
	readonly revokedKeys: number;
	readonly softDeletedUsageLogs: number;
}

async function createRevokedKey(users: readonly User[]): Promise<RevokedApiKeySeed> {
	const owner = requireRow(
		users.find((user) => user.email === REVOKED_API_KEY_OWNER_EMAIL),
		`user ${REVOKED_API_KEY_OWNER_EMAIL}`,
	);
	const rawKey = `sk_live_${randomBytes(REVOKED_KEY_SECRET_BYTES).toString("base64url")}`;
	const seed = buildRevokedApiKeySeed({
		userId: owner.id,
		keyHash: await bcrypt.hash(rawKey, SEED_BCRYPT_ROUNDS),
		keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
	});
	await prisma.$transaction([
		prisma.apiKey.upsert({ where: { id: REVOKED_API_KEY_ID }, create: seed.key, update: {} }),
		prisma.apiKeyUsageLog.createMany({ data: [...seed.usageLogs], skipDuplicates: true }),
	]);
	return seed;
}

/** Rolls usage up onto every key of the seed accounts, then adds the revoked key. */
export async function seedApiKeyLifecycle(users: readonly User[]): Promise<ApiKeyLifecycleSummary> {
	const revoked = await createRevokedKey(users);
	const groups = await prisma.apiKeyUsageLog.groupBy({
		by: ["apiKeyId"],
		where: { apiKey: { userId: { in: users.map((user) => user.id) } } },
		_count: { _all: true },
		_max: { createdAt: true },
	});
	await prisma.$transaction(
		groups.map((group) => prisma.apiKey.update({ where: { id: group.apiKeyId }, data: { totalRequests: group._count._all, lastUsedAt: group._max.createdAt } })),
	);
	return { keysRolledUp: groups.length, revokedKeys: 1, softDeletedUsageLogs: revoked.usageLogs.length };
}
