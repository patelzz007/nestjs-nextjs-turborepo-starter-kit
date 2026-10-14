// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MerchantRewardFormValues, OrganizationContextResponse } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardLocationFields } from "@/components/rewards/merchant-reward-location-fields";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { TestQueryClientProvider } from "@/test/query-client";
import { contextQueryState, organizationContextFixture, STORE_A_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";

const { contextQuery } = vi.hoisted(() => ({
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { organizations: { context: { useQuery: contextQuery } } } }),
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

const ALL_LOCATIONS_DEFAULTS: Partial<MerchantRewardFormValues> = { locationScopeType: "ALL_LOCATIONS", locationIds: [] };

/** The editor's form, reduced to the fields this section owns. */
function LocationFieldsHarness(): React.JSX.Element {
	const { control, formState, setValue } = useForm<MerchantRewardFormValues>({ defaultValues: ALL_LOCATIONS_DEFAULTS });
	return <MerchantRewardLocationFields control={control} errors={formState.errors} setValue={setValue} />;
}

function renderLocationFields(context: OrganizationContextResponse): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	contextQuery.mockReturnValue(contextQueryState(context));
	render(
		<TestQueryClientProvider>
			<TenantContextProvider orgSlug={TEST_ORG_SLUG} initialLocationId={null} initialOrganizationContext={testEnvelope(context)}>
				<LocationFieldsHarness />
			</TenantContextProvider>
		</TestQueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

/** The Availability trigger's value slot — scoped so an open popup's option text is never matched. */
function availabilityValueText(): string | null | undefined {
	return screen.getByRole("combobox").querySelector("[data-slot='select-value']")?.textContent;
}

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	vi.unstubAllGlobals();
});

describe("MerchantRewardLocationFields", () => {
	it("shows the human availability label in the closed trigger, never the raw scope enum", (): void => {
		renderLocationFields(TWO_STORE_CONTEXT);
		expect(screen.queryByRole("option")).toBeNull();
		expect(availabilityValueText()).toBe("All stores");
		expect(screen.getByRole("combobox").textContent).not.toContain("ALL_LOCATIONS");
	});

	it("labels the trigger with the chosen option and reveals the store picker for selected stores", (): void => {
		renderLocationFields(TWO_STORE_CONTEXT);
		act((): void => {
			fireEvent.click(screen.getByRole("combobox"));
		});
		// A real mouse press: base-ui only commits a click that started on the item.
		const selectedOnly = screen.getByRole("option", { name: "Selected stores only" });
		act((): void => {
			fireEvent.pointerDown(selectedOnly, { pointerType: "mouse" });
			fireEvent.click(selectedOnly);
		});
		expect(availabilityValueText()).toBe("Selected stores only");
		expect(screen.getByRole("checkbox", { name: STORE_A.name })).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: STORE_B.name })).toBeTruthy();
	});

	it("renders nothing for a single-store organization", (): void => {
		renderLocationFields(organizationContextFixture({ locations: [STORE_A_LOCATION] }));
		expect(screen.queryByRole("combobox")).toBeNull();
	});
});
