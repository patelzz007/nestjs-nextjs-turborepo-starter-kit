// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CacheView, formatHitRatio, formatTtl } from "@/contexts/operations/components/cache-view";

const { cacheQuery, flushMutate } = vi.hoisted(() => ({ cacheQuery: vi.fn(), flushMutate: vi.fn() }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (): boolean => true }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: { operations: { cache: { useQuery: cacheQuery }, flushCache: { useMutation: (): object => ({ mutate: flushMutate, isPending: false }) } } },
	}),
}));

const MB = 1_048_576;

beforeEach((): void => {
	cacheQuery.mockReturnValue({
		data: {
			data: {
				namespaces: [
					{
						name: "reference-data",
						version: 2,
						tier: "two-tier",
						scope: "platform",
						encrypted: false,
						ttlMs: 300_000,
						localEntries: 12,
						sharedKeys: 40,
						sharedMaxKeys: 1000,
						hits: 94,
						misses: 6,
						staleServed: 0,
						loadFailures: 1,
						refusedWrites: 0,
						hitRatio: 0.94,
					},
				],
				redis: { usedBytes: 90 * MB, maxBytes: 100 * MB, policy: "noeviction", alertPercent: 80, policyOk: true },
				circuitOpen: true,
			},
		},
	});
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("cache formatting", () => {
	it("reads ratios and TTLs the way people do", () => {
		expect(formatHitRatio(0.936)).toBe("94%");
		expect(formatHitRatio(null)).toBe("—");
		expect(formatTtl(300_000)).toBe("5 min");
		expect(formatTtl(7_200_000)).toBe("2 h");
		expect(formatTtl(45_000)).toBe("45 s");
	});
});

describe("CacheView", () => {
	it("shows each cache, Redis memory against its alert line, and an open circuit", () => {
		render(<CacheView />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("reference-data")).toBeTruthy();
		expect(screen.getByText("94%")).toBeTruthy();
		expect(screen.getByText("No eviction")).toBeTruthy();
		expect(screen.getByText("Above the 80% alert line.")).toBeTruthy();
		expect(screen.getByText("Redis is not answering")).toBeTruthy();
	});

	it("flushes one cache with an audited reason", () => {
		render(<CacheView />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Flush" }));
		});

		expect(flushMutate).toHaveBeenCalledWith(expect.objectContaining({ target: "namespace", name: "reference-data" }));
	});

	it("flushes a tenant only once its id and a reason are given", () => {
		render(<CacheView />, { wrapper: UiKitTestProviders });
		const button = screen.getByRole("button", { name: "Flush tenant" });
		expect(button.hasAttribute("disabled")).toBe(true);

		fireEvent.change(screen.getByLabelText("Tenant ID"), { target: { value: "0193f2c4-0000-7000-8000-0000000000c1" } });
		fireEvent.change(screen.getByLabelText("Why (at least 10 characters)"), { target: { value: "Fixed the address by hand" } });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Flush tenant" }));
		});

		expect(flushMutate).toHaveBeenCalledWith({ target: "tenant", tenantId: "0193f2c4-0000-7000-8000-0000000000c1", reason: "Fixed the address by hand" });
	});
});
