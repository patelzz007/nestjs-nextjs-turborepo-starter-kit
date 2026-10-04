import type * as ServerApi from "@workspace/client/lib/api/server-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRewardDetail } from "@/lib/rewards/reward-detail-server";
import { pageExit } from "@/test-support/navigation";
import { testEnvelope } from "@/test-support/envelope";
import { buildRewardResponse } from "@/test-support/reward";
import { failedQuery, httpFailure } from "@/test-support/server-query";

const { rewardDetailQuery } = vi.hoisted(() => ({ rewardDetailQuery: vi.fn() }));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ rewards: { detail: { query: rewardDetailQuery } } }) }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

const REWARD = buildRewardResponse();

beforeEach((): void => {
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("loadRewardDetail (both reward detail pages)", () => {
	it("returns the reward the API serves", async () => {
		rewardDetailQuery.mockResolvedValue(testEnvelope(REWARD));

		await expect(loadRewardDetail(REWARD.id)).resolves.toEqual(testEnvelope(REWARD));
		expect(rewardDetailQuery).toHaveBeenCalledWith({ rewardId: REWARD.id });
	});

	it("renders not-found for a malformed id without calling the API", async () => {
		await expect(
			pageExit(async (): Promise<void> => {
				await loadRewardDetail("latte");
			}),
		).resolves.toEqual({ kind: "not-found" });
		expect(rewardDetailQuery).not.toHaveBeenCalled();
	});

	it("renders not-found for a reward the API does not serve (404)", async () => {
		rewardDetailQuery.mockImplementation(() => failedQuery(httpFailure(404)));

		await expect(
			pageExit(async (): Promise<void> => {
				await loadRewardDetail(REWARD.id);
			}),
		).resolves.toEqual({ kind: "not-found" });
	});

	it("rethrows an API outage to the error boundary instead of showing 'Reward unavailable'", async () => {
		rewardDetailQuery.mockImplementation(() => failedQuery({ kind: "unreachable", cause: "ECONNREFUSED" }));

		await expect(loadRewardDetail(REWARD.id)).rejects.toThrow("rewards.detail failed during server render: network (ECONNREFUSED)");
	});

	it("treats a 401 as unexpected — the endpoint is public, so the API never sends one", async () => {
		rewardDetailQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(loadRewardDetail(REWARD.id)).rejects.toThrow("HTTP 401");
	});
});
