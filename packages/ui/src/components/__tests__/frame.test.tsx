// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "../frame";

afterEach((): void => {
	cleanup();
});

describe("Frame", () => {
	it("composes a header, panels and a footer with their slots", (): void => {
		const { container } = render(
			<Frame>
				<FrameHeader>
					<FrameTitle>Billing</FrameTitle>
					<FrameDescription>Your plan</FrameDescription>
				</FrameHeader>
				<FramePanel>Body</FramePanel>
				<FrameFooter>Footer</FrameFooter>
			</Frame>,
		);
		expect(container.querySelector('[data-slot="frame"]')).toBeTruthy();
		expect(screen.getByRole("banner").dataset.slot).toBe("frame-panel-header");
		expect(screen.getByRole("contentinfo").dataset.slot).toBe("frame-panel-footer");
		expect(screen.getByText("Billing").dataset.slot).toBe("frame-panel-title");
		expect(screen.getByText("Your plan").className).toContain("text-muted-foreground");
		expect(screen.getByText("Body").dataset.slot).toBe("frame-panel");
	});

	it("applies its variant, spacing, stacked and dense variants", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Frame ref={ref} variant="inverse" spacing="sm" stacked dense />);
		const frame = ref.current;
		expect(frame?.dataset.spacing).toBe("sm");
		expect(frame?.className).toContain("bg-background");
		expect(frame?.className).toContain("[--frame-panel-py-base:--spacing(3.5)]");
		expect(frame?.className).toContain("*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0");
		expect(frame?.className).toContain("p-0");
	});

	it("grows a panel unless it is fit to its content", (): void => {
		render(
			<>
				<FramePanel>Grow</FramePanel>
				<FramePanel fit>Fit</FramePanel>
			</>,
		);
		expect(screen.getByText("Grow").className).toContain("grow");
		expect(screen.getByText("Fit").className).not.toContain("grow");
	});

	it("forwards every part's ref and merges className", (): void => {
		const frameRef = React.createRef<HTMLDivElement>();
		const panelRef = React.createRef<HTMLDivElement>();
		const headerRef = React.createRef<HTMLElement>();
		const titleRef = React.createRef<HTMLDivElement>();
		const descriptionRef = React.createRef<HTMLDivElement>();
		const footerRef = React.createRef<HTMLElement>();
		render(
			<Frame ref={frameRef} className="w-80">
				<FrameHeader ref={headerRef} className="gap-2">
					<FrameTitle ref={titleRef}>Title</FrameTitle>
					<FrameDescription ref={descriptionRef}>Description</FrameDescription>
				</FrameHeader>
				<FramePanel ref={panelRef} className="bg-muted">
					Body
				</FramePanel>
				<FrameFooter ref={footerRef}>Footer</FrameFooter>
			</Frame>,
		);
		expect(frameRef.current?.className).toContain("w-80");
		expect(panelRef.current?.className).toContain("bg-muted");
		expect(headerRef.current?.className).toContain("gap-2");
		expect(titleRef.current?.textContent).toBe("Title");
		expect(descriptionRef.current?.textContent).toBe("Description");
		expect(footerRef.current?.tagName).toBe("FOOTER");
	});
});
