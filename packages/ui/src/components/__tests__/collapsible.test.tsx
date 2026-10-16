// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

afterEach((): void => {
	cleanup();
});

describe("Collapsible", () => {
	it("forwards refs on the root, the trigger and the content", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const triggerRef = React.createRef<HTMLButtonElement>();
		const contentRef = React.createRef<HTMLDivElement>();
		render(
			<Collapsible ref={rootRef} defaultOpen>
				<CollapsibleTrigger ref={triggerRef}>Toggle</CollapsibleTrigger>
				<CollapsibleContent ref={contentRef}>Body</CollapsibleContent>
			</Collapsible>,
		);

		expect(rootRef.current?.dataset.slot).toBe("collapsible");
		expect(triggerRef.current?.dataset.slot).toBe("collapsible-trigger");
		expect(contentRef.current?.dataset.slot).toBe("collapsible-content");
	});

	it("is controlled by open / onOpenChange", (): void => {
		const onOpenChange = vi.fn();
		render(
			<Collapsible open={false} onOpenChange={onOpenChange}>
				<CollapsibleTrigger>Toggle</CollapsibleTrigger>
				<CollapsibleContent>Body</CollapsibleContent>
			</Collapsible>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

		expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
		expect(screen.getByRole("button", { name: "Toggle" }).getAttribute("aria-expanded")).toBe("false");
	});
});
