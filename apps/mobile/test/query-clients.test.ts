import { apiRouter } from "@workspace/api-client";

import { createTestQueryClient, disposeTrackedQueryClients, trackQueryClient } from "./query-clients";
import { createMobileQueryClient } from "../src/lib/query-client";

/** Any registered key — the cache contents are irrelevant, only their timers. */
const PROFILE_KEY = apiRouter.auth.profile.queryKey(undefined);

describe("test query clients", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("stops the garbage-collection timers of cached queries AND mutations", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(PROFILE_KEY, "cached");
		await queryClient
			.getMutationCache()
			.build(queryClient, { mutationFn: (): Promise<string> => Promise.resolve("done") })
			.execute(undefined);
		expect(jest.getTimerCount()).toBe(2);

		disposeTrackedQueryClients();

		expect(jest.getTimerCount()).toBe(0);
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});

	it("disposes a client it was handed, and forgets every client once disposed", () => {
		const queryClient = createMobileQueryClient({ onUpgradeRequired: jest.fn() });
		expect(trackQueryClient(queryClient)).toBe(queryClient);
		queryClient.setQueryData(PROFILE_KEY, "cached");

		disposeTrackedQueryClients();
		expect(jest.getTimerCount()).toBe(0);

		queryClient.setQueryData(PROFILE_KEY, "cached again");
		disposeTrackedQueryClients();
		expect(jest.getTimerCount()).toBe(1);
		queryClient.clear();
	});
});
