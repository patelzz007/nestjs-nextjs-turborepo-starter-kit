// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, toAccordionValues, type AccordionRef } from "@workspace/ui/components/accordion";

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Accordion", () => {
	it("renders the trigger and exposes the aria-expanded / aria-controls contract (improvement 5)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Accordion ariaLabel="Test accordion">
				<AccordionItem value="a">
					<AccordionTrigger>First</AccordionTrigger>
					<AccordionContent>first body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const trigger = screen.getByRole("button", { name: "First" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(trigger.getAttribute("aria-controls")).toBeNull();

		fireEvent.click(trigger);

		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.getAttribute("aria-controls")).not.toBeNull();
		expect(container.querySelector("[data-slot='accordion-content']")).toBeTruthy();
		// The root exposes the aria-label passed by the smart component.
		expect(screen.getByLabelText("Test accordion")).toBeTruthy();
	});

	it("defaults to single-open: opening a second item closes the first", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger>First</AccordionTrigger>
					<AccordionContent>first body</AccordionContent>
				</AccordionItem>
				<AccordionItem value="b">
					<AccordionTrigger>Second</AccordionTrigger>
					<AccordionContent>second body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const first = screen.getByRole("button", { name: "First" });
		const second = screen.getByRole("button", { name: "Second" });

		fireEvent.click(first);
		fireEvent.click(second);

		expect(first.getAttribute("aria-expanded")).toBe("false");
		expect(second.getAttribute("aria-expanded")).toBe("true");
	});

	it("keeps multiple items open when `multiple` is set", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Accordion multiple>
				<AccordionItem value="a">
					<AccordionTrigger>First</AccordionTrigger>
					<AccordionContent>first body</AccordionContent>
				</AccordionItem>
				<AccordionItem value="b">
					<AccordionTrigger>Second</AccordionTrigger>
					<AccordionContent>second body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const first = screen.getByRole("button", { name: "First" });
		const second = screen.getByRole("button", { name: "Second" });

		fireEvent.click(first);
		fireEvent.click(second);

		expect(first.getAttribute("aria-expanded")).toBe("true");
		expect(second.getAttribute("aria-expanded")).toBe("true");
	});

	it("does not open a disabled item (improvement 3)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Accordion>
				<AccordionItem value="a" disabled>
					<AccordionTrigger>Locked</AccordionTrigger>
					<AccordionContent>secret body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const trigger = screen.getByRole("button", { name: "Locked" });
		fireEvent.click(trigger);

		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		// The wrapper sets its own data-disabled hook so the visual state is
		// independent of which attributes base-ui happens to emit.
		expect(container.querySelector("[data-slot='accordion-item']")?.getAttribute("data-disabled")).toBe("");
	});

	it("supports the controlled value / onValueChange API (improvements 9 + 19)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function ControlledHarness(): React.JSX.Element {
			const [values, setValues] = useState<string[]>([]);
			return (
				<Accordion value={values} onValueChange={setValues}>
					<AccordionItem value="a">
						<AccordionTrigger>First</AccordionTrigger>
						<AccordionContent>first body</AccordionContent>
					</AccordionItem>
				</Accordion>
			);
		}

		render(<ControlledHarness />);
		const trigger = screen.getByRole("button", { name: "First" });
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	it("exposes the imperative expandAll / collapseAll ref API (feature 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function RefHarness(): React.JSX.Element {
			const accordionRef = useRef<AccordionRef | null>(null);
			const handleExpandAll = useCallback((): void => {
				accordionRef.current?.expandAll();
			}, []);
			const handleCollapseAll = useCallback((): void => {
				accordionRef.current?.collapseAll();
			}, []);
			return (
				<div>
					<button type="button" onClick={handleExpandAll}>
						Expand all
					</button>
					<button type="button" onClick={handleCollapseAll}>
						Collapse all
					</button>
					<Accordion multiple ref={accordionRef}>
						<AccordionItem value="a">
							<AccordionTrigger>First</AccordionTrigger>
							<AccordionContent>first body</AccordionContent>
						</AccordionItem>
						<AccordionItem value="b">
							<AccordionTrigger>Second</AccordionTrigger>
							<AccordionContent>second body</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			);
		}

		render(<RefHarness />);
		const first = screen.getByRole("button", { name: "First" });
		const second = screen.getByRole("button", { name: "Second" });

		fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
		expect(first.getAttribute("aria-expanded")).toBe("true");
		expect(second.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
		expect(first.getAttribute("aria-expanded")).toBe("false");
		expect(second.getAttribute("aria-expanded")).toBe("false");
	});

	it("highlights matching text in a string trigger label (feature 4)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger highlight="token">Show the token here</AccordionTrigger>
					<AccordionContent>body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const mark = screen.getByText("token");
		expect(mark.tagName).toBe("MARK");
	});

	it("renders the icon, shortcut and count slots — and replaces the default chevron (improvement 4, features 6/8)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger icon={<span data-testid="custom-icon">+</span>} shortcut="⌘1" count={3}>
						With slots
					</AccordionTrigger>
					<AccordionContent>body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		expect(screen.getByTestId("custom-icon")).toBeTruthy();
		expect(screen.getByText("⌘1")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		// The custom icon replaces the default chevron.
		expect(container.querySelector("[data-slot='accordion-trigger-icon']")).toBeNull();
	});

	it("renders a status icon that replaces the chevron (feature 12)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger status="done">Deployment done</AccordionTrigger>
					<AccordionContent>body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		expect(container.querySelector("[data-slot='accordion-status-icon']")).toBeTruthy();
		expect(container.querySelector("[data-slot='accordion-trigger-icon']")).toBeNull();
	});

	it("mounts lazy panel content only after the first open (feature 11)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Accordion>
				<AccordionItem value="a" lazy>
					<AccordionTrigger>Lazy</AccordionTrigger>
					<AccordionContent>lazy body</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		expect(screen.queryByText("lazy body")).toBeNull();

		const trigger = screen.getByRole("button", { name: "Lazy" });
		fireEvent.click(trigger);

		expect(screen.getByText("lazy body")).toBeTruthy();
	});

	it("toggles a single value without collapsing siblings in `multiple` mode (feature 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function ToggleHarness(): React.JSX.Element {
			const accordionRef = useRef<AccordionRef | null>(null);
			const handleToggleFirst = useCallback((): void => {
				accordionRef.current?.toggle("a");
			}, []);
			return (
				<div>
					<button type="button" onClick={handleToggleFirst}>
						Toggle first
					</button>
					<Accordion multiple ref={accordionRef}>
						<AccordionItem value="a">
							<AccordionTrigger>First</AccordionTrigger>
							<AccordionContent>first body</AccordionContent>
						</AccordionItem>
						<AccordionItem value="b">
							<AccordionTrigger>Second</AccordionTrigger>
							<AccordionContent>second body</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			);
		}

		render(<ToggleHarness />);
		const first = screen.getByRole("button", { name: "First" });
		const second = screen.getByRole("button", { name: "Second" });

		// Open both via the UI, then toggle `a` — it should close without
		// touching `b` (union semantics, not replace-the-set semantics).
		fireEvent.click(first);
		fireEvent.click(second);
		expect(first.getAttribute("aria-expanded")).toBe("true");
		expect(second.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Toggle first" }));
		expect(first.getAttribute("aria-expanded")).toBe("false");
		expect(second.getAttribute("aria-expanded")).toBe("true");
	});

	it("supports nested accordions: an inner accordion inside an outer item's content toggles independently (feature 14)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Accordion>
				<AccordionItem value="outer">
					<AccordionTrigger>Outer</AccordionTrigger>
					<AccordionContent>
						<Accordion multiple>
							<AccordionItem value="inner-a">
								<AccordionTrigger>Inner A</AccordionTrigger>
								<AccordionContent>inner a body</AccordionContent>
							</AccordionItem>
							<AccordionItem value="inner-b">
								<AccordionTrigger>Inner B</AccordionTrigger>
								<AccordionContent>inner b body</AccordionContent>
							</AccordionItem>
						</Accordion>
					</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		const outerTrigger = screen.getByRole("button", { name: "Outer" });
		fireEvent.click(outerTrigger);

		// Inner accordion renders only after the outer panel opens.
		const innerA = screen.getByRole("button", { name: "Inner A" });
		const innerB = screen.getByRole("button", { name: "Inner B" });
		expect(innerA.getAttribute("aria-expanded")).toBe("false");

		// Inner items toggle independently of each other and of the outer item.
		fireEvent.click(innerA);
		expect(innerA.getAttribute("aria-expanded")).toBe("true");
		expect(innerB.getAttribute("aria-expanded")).toBe("false");
		expect(screen.getByText("inner a body")).toBeTruthy();
		expect(outerTrigger.getAttribute("aria-expanded")).toBe("true");
	});

	it("keeps the render-free contract: nothing renders without children", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(<Accordion />);
		expect(container.textContent).toBe("");
	});

	it("normalizes values with toAccordionValues", () => {
		expect(toAccordionValues("a")).toEqual(["a"]);
		expect(toAccordionValues(["a", "b"])).toEqual(["a", "b"]);
	});
});
