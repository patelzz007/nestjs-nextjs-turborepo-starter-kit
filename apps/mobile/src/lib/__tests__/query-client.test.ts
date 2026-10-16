import { ApiError, apiRouter, UpgradeRequiredError } from "@workspace/api-client";

import { trackQueryClient } from "../../../test/query-clients";
import { clearQueryClient, createMobileQueryClient, minimumVersionOf, shouldRetryQuery } from "../query-client";

function upgradeError(details?: Record<string, string>): UpgradeRequiredError {
	return new UpgradeRequiredError({ message: "Update", error: "APP_VERSION_UNSUPPORTED", statusCode: 426 }, details === undefined ? {} : { details });
}

describe("minimumVersionOf", () => {
	it("reads the minimum version from a 426's details", () => {
		expect(minimumVersionOf(upgradeError({ reason: "below_minimum", minimumVersion: "2.1.0" }))).toBe("2.1.0");
	});

	it("is null when the details do not carry a semantic version", () => {
		expect(minimumVersionOf(upgradeError())).toBeNull();
		expect(minimumVersionOf(upgradeError({ minimumVersion: "latest" }))).toBeNull();
	});
});

describe("shouldRetryQuery", () => {
	it("retries network and server failures twice", () => {
		expect(shouldRetryQuery(0, new TypeError("Network request failed"))).toBe(true);
		expect(shouldRetryQuery(1, new ApiError({ message: "down", statusCode: 503 }))).toBe(true);
		expect(shouldRetryQuery(2, new TypeError("Network request failed"))).toBe(false);
	});

	it("never retries an answer the API gave on purpose (4xx)", () => {
		expect(shouldRetryQuery(0, new ApiError({ message: "nope", statusCode: 403 }))).toBe(false);
		expect(shouldRetryQuery(0, upgradeError())).toBe(false);
	});
});

describe("createMobileQueryClient", () => {
	it("reports a 426 from any query or mutation", async () => {
		const onUpgradeRequired = jest.fn();
		const queryClient = trackQueryClient(createMobileQueryClient({ onUpgradeRequired }));

		await expect(
			queryClient.query({ queryKey: ["probe"], queryFn: (): Promise<string> => Promise.reject(upgradeError({ minimumVersion: "3.0.0" })), retry: false }),
		).rejects.toThrow();
		await expect(
			queryClient
				.getMutationCache()
				.build(queryClient, { mutationFn: (): Promise<string> => Promise.reject(upgradeError()) })
				.execute(undefined),
		).rejects.toThrow();

		expect(onUpgradeRequired.mock.calls).toEqual([["3.0.0"], [null]]);
	});

	it("ignores every other error", async () => {
		const onUpgradeRequired = jest.fn();
		const queryClient = trackQueryClient(createMobileQueryClient({ onUpgradeRequired }));

		await expect(queryClient.query({ queryKey: ["probe"], queryFn: (): Promise<string> => Promise.reject(new Error("boom")), retry: false })).rejects.toThrow("boom");
		expect(onUpgradeRequired).not.toHaveBeenCalled();
	});
});

describe("clearQueryClient", () => {
	const PROFILE_KEY = apiRouter.auth.profile.queryKey(undefined);

	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("drops every query and mutation and stops their timers — where clear() leaves the mutations' running", async () => {
		const queryClient = trackQueryClient(createMobileQueryClient({ onUpgradeRequired: jest.fn() }));
		const runMutation = (): Promise<string> =>
			queryClient
				.getMutationCache()
				.build(queryClient, { mutationFn: (): Promise<string> => Promise.resolve("done") })
				.execute(undefined);

		queryClient.setQueryData(PROFILE_KEY, "cached");
		await runMutation();
		queryClient.clear();
		// The library's clear() released the query's timer but not the mutation's.
		expect(jest.getTimerCount()).toBe(1);
		jest.clearAllTimers();

		queryClient.setQueryData(PROFILE_KEY, "cached");
		await runMutation();
		clearQueryClient(queryClient);

		expect(jest.getTimerCount()).toBe(0);
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});
});
