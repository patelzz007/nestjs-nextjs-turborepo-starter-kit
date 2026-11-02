// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimitsView, toOverrideInput, type OverrideDraft } from "@/contexts/operations/components/rate-limits-view";

const { overviewQuery, overridesQuery, liftMutate, removeMutate, setMutate, granted } = vi.hoisted(() => ({
	overviewQuery: vi.fn(),
	overridesQuery: vi.fn(),
	liftMutate: vi.fn(),
	removeMutate: vi.fn(),
	setMutate: vi.fn(),
	granted: { value: true },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (): boolean => granted.value }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			operations: {
				rateLimits: { useQuery: overviewQuery },
				rateLimitOverrides: { useQuery: overridesQuery },
				liftRateLimitPenalty: { useMutation: (): object => ({ mutate: liftMutate, isPending: false }) },
				removeRateLimitOverride: { useMutation: (): object => ({ mutate: removeMutate, isPending: false }) },
				setRateLimitOverride: { useMutation: (): object => ({ mutate: setMutate, isPending: false }) },
			},
		},
	}),
}));

const TENANT = "0193f2c4-0000-7000-8000-0000000000c1";
const DRAFT: OverrideDraft = {
	tenantId: TENANT,
	policyName: "TENANT_TRAFFIC",
	ratePerSecond: "50",
	burst: "200",
	perWeek: "10",
	expiresOn: "2026-12-01",
	reason: "Launch week for 40 tills",
};

beforeEach((): void => {
	granted.value = true;
	overviewQuery.mockReturnValue({
		data: {
			data: {
				policies: [
					{ name: "auth", algorithm: "sliding-window", subject: "ip", limit: "10 / min", failMode: "closed", penalty: true, refusedLastHour: 7, refusalsByTenMinutes: [] },
				],
				topSubjects: [{ policyName: "auth", subjectKind: "ip", maskedSubject: "203.0.113.•", subjectRef: "a".repeat(32), refusals: 7, penalized: true }],
				exemptions: [{ kind: "load-test", label: "Load test runner" }],
			},
		},
	});
	overridesQuery.mockReturnValue({
		data: {
			data: [
				{
					id: "0193f2c4-0000-7000-8000-0000000000e1",
					tenantId: TENANT,
					tenantName: "Sunrise Cafe",
					policyName: "TENANT_BROADCASTS",
					limit: 10,
					windowMs: 604_800_000,
					reason: "Festival season",
					expiresAt: epochMs(Date.UTC(2026, 11, 1)),
					setByUserId: TENANT,
					createdAt: epochMs(0),
					updatedAt: epochMs(0),
					isDeleted: false,
					deletedAt: null,
				},
			],
		},
	});
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("toOverrideInput", () => {
	it("reads traffic as a rate and a burst until the end of the chosen day", () => {
		const result = toOverrideInput(DRAFT);

		expect(result.ok ? result.input : null).toEqual({
			tenantId: TENANT,
			policyName: "TENANT_TRAFFIC",
			ratePerSecond: 50,
			burst: 200,
			expiresAt: Date.UTC(2026, 11, 1, 23, 59, 59),
			reason: DRAFT.reason,
		});
	});

	it("reads broadcasts as a weekly count", () => {
		const result = toOverrideInput({ ...DRAFT, policyName: "TENANT_BROADCASTS" });

		expect(result.ok ? result.input : null).toMatchObject({ policyName: "TENANT_BROADCASTS", perWeek: 10 });
	});

	it("names what is wrong", () => {
		expect(toOverrideInput({ ...DRAFT, burst: "10" })).toEqual({ ok: false, message: "burst: The burst is at least one second's worth of the rate" });
		expect(toOverrideInput({ ...DRAFT, tenantId: "nope" }).ok).toBe(false);
	});
});

describe("RateLimitsView", () => {
	it("lists the policies, who is refused most, exemptions and overrides", () => {
		render(<RateLimitsView />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("auth")).toBeTruthy();
		expect(screen.getByText("203.0.113.•")).toBeTruthy();
		expect(screen.getByText(/Load test runner/u)).toBeTruthy();
		expect(screen.getByText("Sunrise Cafe · Broadcasts per week")).toBeTruthy();
		expect(screen.getByText(/10 per week/u)).toBeTruthy();
	});

	it("lifts a penalty and removes an override", () => {
		render(<RateLimitsView />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Lift penalty" }));
			fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		});

		expect(liftMutate).toHaveBeenCalledWith(expect.objectContaining({ subjectRef: "a".repeat(32) }));
		expect(removeMutate).toHaveBeenCalledWith({ overrideId: "0193f2c4-0000-7000-8000-0000000000e1" });
	});

	it("only shows changes to staff who may make them", () => {
		granted.value = false;
		render(<RateLimitsView />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("button", { name: "Lift penalty" })).toBeNull();
		expect(screen.queryByRole("form", { name: "Set an override" })).toBeNull();
	});

	it("explains a bad override instead of saving it", () => {
		render(<RateLimitsView />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save override" }));
		});

		expect(setMutate).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toMatch(/^tenantId/u);
	});
});
