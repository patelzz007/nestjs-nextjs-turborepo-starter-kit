// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import {
	MERCHANT_PAGE_LOADING_LABELS,
	MERCHANT_VERIFICATION_LOADING_LABELS,
	MerchantKybVerificationSectionSkeleton,
	MerchantPageSkeleton,
} from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";

afterEach((): void => {
	cleanup();
});

describe("MerchantPageSkeleton", () => {
	it("draws a page header and one content panel, announcing a generic load", () => {
		const { container } = render(<MerchantPageSkeleton />, { wrapper: UiKitTestProviders });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_PAGE_LOADING_LABELS.loading]);
		expect(container.querySelector('[data-slot="merchant-page-header-skeleton"]')).not.toBeNull();
		expect(container.querySelector('[data-slot="prose-skeleton"]')).not.toBeNull();
	});

	it("names what loads when the caller says so", () => {
		render(<MerchantPageSkeleton labels={{ loading: "Checking access…" }} />, { wrapper: UiKitTestProviders });

		expect(busyRegionAnnouncements()).toEqual(["Checking access…"]);
	});
});

describe("MerchantKybVerificationSectionSkeleton", () => {
	it("draws only the verification form — no page header — for the gate around that section", () => {
		const { container } = render(<MerchantKybVerificationSectionSkeleton />, { wrapper: UiKitTestProviders });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_VERIFICATION_LOADING_LABELS.loading]);
		expect(container.querySelector('[data-slot="kyb-verification-skeleton"]')).not.toBeNull();
		expect(container.querySelector('[data-slot="page-header-skeleton"]')).toBeNull();
	});
});
