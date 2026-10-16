import { describe, expect, it, vi } from "vitest";

import { createProxyRefreshCooldown, type ProxyRefreshResult } from "./proxy-refresh";

const TRANSIENT: ProxyRefreshResult = { ok: false, status: 503, setCookies: [] };
const DEAD: ProxyRefreshResult = { ok: false, status: 401, setCookies: [] };
const ROTATED: ProxyRefreshResult = { ok: true, status: 200, setCookies: ["accessToken=a", "refreshToken=b"] };
const COOLDOWN_MS = 60_000;

function clock(): { readonly now: () => number; readonly advance: (ms: number) => void } {
	let current = 1_000_000;
	return {
		now: (): number => current,
		advance: (ms: number): void => {
			current += ms;
		},
	};
}

describe("createProxyRefreshCooldown", () => {
	it("cools down only the refresh token that failed — another member's refresh still runs", async () => {
		const attempt = vi.fn<(token: string) => Promise<ProxyRefreshResult>>().mockResolvedValueOnce(TRANSIENT).mockResolvedValueOnce(ROTATED);
		const refresh = createProxyRefreshCooldown(attempt, { cooldownMs: COOLDOWN_MS, now: clock().now });

		await refresh("token-of-member-a");
		const memberA = await refresh("token-of-member-a");
		const memberB = await refresh("token-of-member-b");

		expect(memberA.skipped).toBe(true);
		expect(memberB).toEqual(ROTATED);
		expect(attempt.mock.calls.map(([token]) => token)).toEqual(["token-of-member-a", "token-of-member-b"]);
	});

	it("retries the same token once its cooldown has passed", async () => {
		const time = clock();
		const attempt = vi.fn<(token: string) => Promise<ProxyRefreshResult>>().mockResolvedValueOnce(TRANSIENT).mockResolvedValueOnce(ROTATED);
		const refresh = createProxyRefreshCooldown(attempt, { cooldownMs: COOLDOWN_MS, now: time.now });

		await refresh("token");
		time.advance(COOLDOWN_MS);

		await expect(refresh("token")).resolves.toEqual(ROTATED);
	});

	it("opens the circuit for everyone after a burst of failures across members (the API is down)", async () => {
		const attempt = vi.fn<(token: string) => Promise<ProxyRefreshResult>>().mockResolvedValue(TRANSIENT);
		const refresh = createProxyRefreshCooldown(attempt, { cooldownMs: COOLDOWN_MS, circuitThreshold: 3, circuitWindowMs: 10_000, now: clock().now });

		await refresh("a");
		await refresh("b");
		await refresh("c");
		const untouchedMember = await refresh("d");

		expect(untouchedMember.skipped).toBe(true);
		expect(attempt).toHaveBeenCalledTimes(3);
	});

	it("never memoizes a dead session (401): the next navigation asks again", async () => {
		const attempt = vi.fn<(token: string) => Promise<ProxyRefreshResult>>().mockResolvedValue(DEAD);
		const refresh = createProxyRefreshCooldown(attempt, { cooldownMs: COOLDOWN_MS, now: clock().now });

		await refresh("token");
		await refresh("token");

		expect(attempt).toHaveBeenCalledTimes(2);
	});

	it("lets an auth route bypass the cooldown", async () => {
		const attempt = vi.fn<(token: string) => Promise<ProxyRefreshResult>>().mockResolvedValueOnce(TRANSIENT).mockResolvedValueOnce(ROTATED);
		const refresh = createProxyRefreshCooldown(attempt, { cooldownMs: COOLDOWN_MS, now: clock().now });

		await refresh("token");

		await expect(refresh("token", { bypassCooldown: true })).resolves.toEqual(ROTATED);
	});
});
