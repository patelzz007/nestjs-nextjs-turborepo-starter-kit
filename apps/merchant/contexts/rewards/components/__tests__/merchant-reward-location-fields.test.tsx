// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TenantContextResponse } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardLocationFields } from "@/contexts/rewards/components/merchant-reward-location-fields";
import { useRewardEditorForm, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { TestQueryClientProvider } from "@/test/query-client";
import { contextQueryState, tenantContextFixture, STORE_A_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";

const { contextQuery } = vi.hoisted(() => ({
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { context: { useQuery: contextQuery } } } }),
}));

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

const ALL_LOCATIONS_DEFAULTS: RewardEditorInput = {
	rewardType: "DISCOUNT",
	title: "",
	description: "",
	imageFileIds: [],
	rewardValue: "0",
	minPurchase: "",
	termsConditions: "",
	startDate: "2026-11-01",
	expiryDate: "2026-11-30",
	quantityTotal: "100",
	maxClaimsPerUser: 1,
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

/** This section never saves. */
function ignoreSave(): void {
	return undefined;
}

/** The editor's real form, around the section that owns the store fields. */
function LocationFieldsHarness(): React.JSX.Element {
	const { editor } = useRewardEditorForm<null>({ defaultValues: ALL_LOCATIONS_DEFAULTS, defaultMeta: null, onValid: ignoreSave });
	return <MerchantRewardLocationFields editor={editor} />;
}

function renderLocationFields(context: TenantContextResponse): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	contextQuery.mockReturnValue(contextQueryState(context));
	render(
		<TestQueryClientProvider>
			<TenantContextProvider tenantSlug={TEST_ORG_SLUG} initialLocationId={null} initialTenantContext={testEnvelope(context)}>
				<LocationFieldsHarness />
			</TenantContextProvider>
		</TestQueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	vi.unstubAllGlobals();
});

describe("MerchantRewardLocationFields", () => {
	it("offers all stores or some stores as two choices, starting on all stores with no store picker", (): void => {
		renderLocationFields(TWO_STORE_CONTEXT);
		expect(screen.getByRole("radio", { name: /All stores/u }).getAttribute("aria-checked")).toBe("true");
		expect(screen.getByRole("radio", { name: /Only some stores/u }).getAttribute("aria-checked")).toBe("false");
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("reveals a checkbox per store once only some stores are chosen", (): void => {
		renderLocationFields(TWO_STORE_CONTEXT);
		act((): void => {
			fireEvent.click(screen.getByRole("radio", { name: /Only some stores/u }));
		});
		expect(screen.getByRole("radio", { name: /Only some stores/u }).getAttribute("aria-checked")).toBe("true");
		expect(screen.getByRole("checkbox", { name: STORE_A.name })).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: STORE_B.name })).toBeTruthy();
	});

	it("renders nothing for a single-store tenant", (): void => {
		renderLocationFields(tenantContextFixture({ locations: [STORE_A_LOCATION] }));
		expect(screen.queryByRole("radiogroup")).toBeNull();
	});
});
