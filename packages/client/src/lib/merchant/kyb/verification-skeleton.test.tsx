// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantKybVerificationSkeleton } from "./verification-skeleton";
import { MERCHANT_KYB_UPDATE_STEPS } from "./verification-update-section";

afterEach((): void => {
	cleanup();
});

describe("MerchantKybVerificationSkeleton", () => {
	it("draws one progress segment per verification step", (): void => {
		const { container } = render(<MerchantKybVerificationSkeleton />);

		expect(container.querySelectorAll('[data-slot="kyb-step-skeleton"]')).toHaveLength(MERCHANT_KYB_UPDATE_STEPS.length);
	});

	it("ends on the full-width submit, like the business step's form", (): void => {
		const { container } = render(<MerchantKybVerificationSkeleton />);

		const bones = container.querySelectorAll('[data-slot="skeleton"]');
		expect(bones.item(bones.length - 1).className).toContain("w-full");
		expect(bones.item(bones.length - 1).className).toContain("h-11");
	});
});
