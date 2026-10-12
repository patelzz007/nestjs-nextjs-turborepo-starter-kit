// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { Envelope, MerchantKybProfileResponse } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type { JSX, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MERCHANT_KYB_VERIFICATION_LOADING_LABELS } from "./verification-skeleton";
import { MerchantKybVerificationView } from "./verification-view";

/** What the stubbed KYB profile query answers. */
interface ProfileQueryState {
	readonly data: Envelope<MerchantKybProfileResponse> | undefined;
	readonly isLoading: boolean;
}

const mocks = vi.hoisted(() => ({
	profile: vi.fn<() => ProfileQueryState>(),
}));

vi.mock("../../auth/index", () => {
	const api = { organizations: { kyb: { get: { useQuery: (): ProfileQueryState => mocks.profile() } } } };
	return { useAuth: (): { readonly api: typeof api } => ({ api }) };
});

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={new QueryClient()}>
			<UiKitTestProviders>{children}</UiKitTestProviders>
		</QueryClientProvider>
	);
}

afterEach((): void => {
	cleanup();
});

describe("MerchantKybVerificationView loading", () => {
	it("draws the verification form's shape in one busy region while the profile loads", (): void => {
		mocks.profile.mockReturnValue({ data: undefined, isLoading: true });
		render(<MerchantKybVerificationView orgSlug="acme-coffee" />, { wrapper: Providers });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe(MERCHANT_KYB_VERIFICATION_LOADING_LABELS.loading);
		expect(status.querySelector('[data-slot="kyb-verification-skeleton"]')).not.toBeNull();
	});

	it("says the details could not load once the query settles without a profile", (): void => {
		mocks.profile.mockReturnValue({ data: undefined, isLoading: false });
		render(<MerchantKybVerificationView orgSlug="acme-coffee" />, { wrapper: Providers });

		expect(screen.getByText("Unable to load business verification details.")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});
});
