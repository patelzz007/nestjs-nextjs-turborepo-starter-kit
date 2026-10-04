import { describe, expect, it } from "vitest";

import { buildRevokedApiKeySeed, REVOKED_API_KEY_ID, REVOKED_KEY_DELETED_AT_MS } from "./api-key-lifecycle";

function build(): ReturnType<typeof buildRevokedApiKeySeed> {
	return buildRevokedApiKeySeed({ userId: "user-bob", keyHash: "$2b$10$hash", keyPrefix: "sk_live_abcd" });
}

describe("buildRevokedApiKeySeed", () => {
	it("describes a deactivated, soft-deleted key with a stable id", () => {
		const { key } = build();

		expect(key).toMatchObject({ id: REVOKED_API_KEY_ID, userId: "user-bob", isActive: false, isDeleted: true, keyHash: "$2b$10$hash" });
		expect(key.deletedAt).toBe(REVOKED_KEY_DELETED_AT_MS);
		expect(Number(key.createdAt)).toBeLessThan(Number(key.deletedAt));
		expect(build().key.id).toBe(key.id);
	});

	it("soft-deletes every usage row together with the key, all created before the deletion", () => {
		const { key, usageLogs } = build();

		expect(usageLogs.length).toBeGreaterThan(0);
		for (const log of usageLogs) {
			expect(log).toMatchObject({ apiKeyId: REVOKED_API_KEY_ID, isDeleted: true, deletedAt: key.deletedAt });
			expect(Number(log.createdAt)).toBeLessThan(Number(key.deletedAt));
			expect(Number(log.createdAt)).toBeGreaterThan(Number(key.createdAt));
		}
		expect(new Set(usageLogs.map((log) => log.id)).size).toBe(usageLogs.length);
	});

	it("keeps total_requests / last_used_at consistent with the usage rows", () => {
		const { key, usageLogs } = build();

		expect(key.totalRequests).toBe(usageLogs.length);
		expect(key.lastUsedAt).toBe(Math.max(...usageLogs.map((log) => Number(log.createdAt))));
	});
});
