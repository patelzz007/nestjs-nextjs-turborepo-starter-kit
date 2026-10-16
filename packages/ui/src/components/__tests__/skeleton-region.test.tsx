import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Skeleton } from "../skeleton";
import { SkeletonRegion } from "../skeleton-region";

afterEach((): void => {
	cleanup();
});

describe("SkeletonRegion", () => {
	it("announces one busy status with the kit's loading copy", (): void => {
		render(
			<SkeletonRegion>
				<Skeleton className="h-4" />
			</SkeletonRegion>,
			{ wrapper: UiKitTestProviders },
		);

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.getAttribute("aria-live")).toBe("polite");
		expect(status.textContent).toBe(UI_KIT_LABELS_EN.skeletonRegion.loading);
	});

	it("names what is loading when the caller says so", (): void => {
		render(<SkeletonRegion labels={{ loading: "Loading claims…" }} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Loading claims…");
	});

	it("hides the bones from assistive tech without taking a layout slot", (): void => {
		const { container } = render(
			<SkeletonRegion className="grid gap-4">
				<Skeleton className="h-4" />
			</SkeletonRegion>,
			{ wrapper: UiKitTestProviders },
		);

		const bone = container.querySelector('[data-slot="skeleton"]');
		const hiddenWrapper = bone?.parentElement;
		expect(hiddenWrapper?.getAttribute("aria-hidden")).toBe("true");
		expect(hiddenWrapper?.className).toBe("contents");
		expect(screen.getByRole("status").className).toContain("skeleton-region");
		expect(screen.getByRole("status").className).toContain("grid");
	});

	it("forwards its ref to the status element", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<SkeletonRegion ref={ref} />, { wrapper: UiKitTestProviders });

		expect(ref.current?.dataset.slot).toBe("skeleton-region");
	});
});
