// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "./timeline";

afterEach((): void => {
	cleanup();
});

const STEPS: readonly string[] = ["Ordered", "Shipped", "Delivered"];

interface FixtureProps {
	readonly value?: number;
	readonly defaultValue?: number;
	readonly orientation?: "horizontal" | "vertical";
}

function Fixture({ value, defaultValue, orientation }: FixtureProps): React.JSX.Element {
	return (
		<Timeline value={value} defaultValue={defaultValue} orientation={orientation}>
			{STEPS.map((title, index) => (
				<TimelineItem key={title} step={index + 1}>
					<TimelineHeader>
						<TimelineSeparator />
						<TimelineDate dateTime="2026-10-16">Oct 16</TimelineDate>
						<TimelineTitle>{title}</TimelineTitle>
						<TimelineIndicator />
					</TimelineHeader>
					<TimelineContent>{`${title} details`}</TimelineContent>
				</TimelineItem>
			))}
		</Timeline>
	);
}

function completedTitles(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="timeline-item"][data-completed]')).map((item) => item.querySelector("h3")?.textContent ?? "");
}

describe("Timeline", () => {
	it("renders its parts with their slots and roles", (): void => {
		render(<Fixture />);
		expect(document.querySelector('[data-slot="timeline"]')?.getAttribute("data-orientation")).toBe("vertical");
		expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
		const date = screen.getAllByText("Oct 16").at(0);
		expect(date?.tagName).toBe("TIME");
		expect(date?.dataset.slot).toBe("timeline-date");
		expect(document.querySelector('[data-slot="timeline-indicator"]')?.getAttribute("aria-hidden")).toBe("true");
		expect(document.querySelector('[data-slot="timeline-separator"]')?.getAttribute("aria-hidden")).toBe("true");
		expect(screen.getByText("Ordered details").dataset.slot).toBe("timeline-content");
	});

	it("completes items up to the default step when uncontrolled", (): void => {
		render(<Fixture />);
		expect(completedTitles()).toEqual(["Ordered"]);
		cleanup();
		render(<Fixture defaultValue={2} />);
		expect(completedTitles()).toEqual(["Ordered", "Shipped"]);
	});

	it("follows a controlled value", (): void => {
		const { rerender } = render(<Fixture value={1} />);
		expect(completedTitles()).toEqual(["Ordered"]);
		rerender(<Fixture value={3} />);
		expect(completedTitles()).toEqual(["Ordered", "Shipped", "Delivered"]);
	});

	it("marks a horizontal orientation", (): void => {
		render(<Fixture orientation="horizontal" />);
		expect(document.querySelector('[data-slot="timeline"]')?.getAttribute("data-orientation")).toBe("horizontal");
	});

	it("throws for an item outside a timeline", (): void => {
		expect((): void => {
			render(<TimelineItem step={1} />);
		}).toThrow("useTimeline must be used within a Timeline");
	});

	it("forwards refs, merges className and honours render", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLDivElement>();
		const titleRef = React.createRef<HTMLHeadingElement>();
		const contentRef = React.createRef<HTMLDivElement>();
		const sectionRender = <section />;
		render(
			<Timeline ref={rootRef} className="gap-4">
				<TimelineItem ref={itemRef} step={1} className="pb-2">
					<TimelineTitle ref={titleRef}>Title</TimelineTitle>
					<TimelineContent ref={contentRef} render={sectionRender}>
						Body
					</TimelineContent>
				</TimelineItem>
			</Timeline>,
		);
		expect(rootRef.current?.className).toContain("gap-4");
		expect(rootRef.current?.className).toContain("group/timeline");
		expect(itemRef.current?.className).toContain("pb-2");
		expect(itemRef.current?.dataset.completed).toBe("");
		expect(titleRef.current?.tagName).toBe("H3");
		expect(contentRef.current?.tagName).toBe("SECTION");
	});
});
