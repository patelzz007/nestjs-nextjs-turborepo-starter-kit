import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Skeleton } from "../skeleton";

afterEach((): void => {
	cleanup();
});

describe("Skeleton", () => {
	it("renders a muted bone that joins the shared sweep", (): void => {
		const { container } = render(<Skeleton className="h-4 w-20" />);
		const bone = container.querySelector('[data-slot="skeleton"]');

		expect(bone?.className).toContain("skeleton-bone");
		expect(bone?.className).toContain("bg-muted");
		expect(bone?.className).toContain("w-20");
	});

	it("rounds fully for the circular and text variants", (): void => {
		const { container } = render(
			<>
				<Skeleton variant="circular" data-testid="circle" />
				<Skeleton variant="text" data-testid="line" />
			</>,
		);

		for (const bone of container.querySelectorAll('[data-slot="skeleton"]')) {
			expect(bone.className).toContain("rounded-full");
		}
	});

	it("tints the bone for the error state", (): void => {
		const { container } = render(<Skeleton state="error" />);

		expect(container.querySelector('[data-slot="skeleton"]')?.className).toContain("bg-destructive/10");
	});

	it("forwards its ref to the bone", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Skeleton ref={ref} />);

		expect(ref.current?.dataset.slot).toBe("skeleton");
	});
});
