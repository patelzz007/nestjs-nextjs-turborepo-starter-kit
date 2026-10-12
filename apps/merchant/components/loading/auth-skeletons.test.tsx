// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { VERIFY_EMAIL_LOADING_LABELS, VerifyEmailStatusSkeleton } from "@/components/loading/auth-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";

afterEach((): void => {
	cleanup();
});

describe("VerifyEmailStatusSkeleton", () => {
	it("stands in for the verify view's one status line, announced once", () => {
		const { container } = render(<VerifyEmailStatusSkeleton />, { wrapper: UiKitTestProviders });

		expect(busyRegionAnnouncements()).toEqual([VERIFY_EMAIL_LOADING_LABELS.loading]);
		expect(screen.getByRole("status").className).toContain("justify-center");
		expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
	});
});
