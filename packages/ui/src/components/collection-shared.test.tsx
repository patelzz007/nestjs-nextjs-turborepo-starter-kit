// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CollectionEmptyAction, CollectionItemLabel, CollectionLoading, CollectionOverflowPill } from "./collection-shared";

afterEach((): void => {
	cleanup();
});

describe("collection-shared parts", () => {
	it("CollectionOverflowPill forwards its ref and renders nothing when no chip is hidden", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		const { rerender } = render(<CollectionOverflowPill ref={ref} slot="chips-overflow" label="More" hiddenCount={2} />);
		expect(ref.current?.dataset.slot).toBe("chips-overflow");
		expect(ref.current?.textContent).toBe("+2");
		expect(ref.current?.className).toContain("h-5.5");

		rerender(<CollectionOverflowPill ref={ref} slot="chips-overflow" label="More" hiddenCount={0} />);
		expect(ref.current).toBeNull();
	});

	it("CollectionLoading forwards its ref to the status row", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<CollectionLoading ref={ref} slot="list-loading" label="Fetching…" />);
		expect(ref.current?.getAttribute("role")).toBe("status");
		expect(screen.getByText("Fetching…")).toBeTruthy();
	});

	it("CollectionItemLabel forwards its ref with and without a description", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		const { rerender } = render(<CollectionItemLabel ref={ref}>Label</CollectionItemLabel>);
		expect(ref.current?.textContent).toBe("Label");

		rerender(
			<CollectionItemLabel ref={ref} description="Secondary">
				Label
			</CollectionItemLabel>,
		);
		expect(ref.current?.textContent).toBe("LabelSecondary");
	});

	it("CollectionEmptyAction forwards its ref and fires onAction", (): void => {
		const ref = React.createRef<HTMLElement>();
		const onAction = vi.fn();
		render(<CollectionEmptyAction ref={ref} slot="empty-action" label="Create" onAction={onAction} />);
		expect(ref.current?.dataset.slot).toBe("empty-action");
		fireEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(onAction).toHaveBeenCalledTimes(1);
	});
});
