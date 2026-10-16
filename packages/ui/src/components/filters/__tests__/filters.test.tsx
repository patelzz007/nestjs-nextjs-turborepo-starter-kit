// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFilterQuery, createFilterRule, findFilterRule, flattenFilterRules } from "../filters-query";
import { FiltersHarness, stubFiltersDom } from "@workspace/ui/testing/filters-test-utils";
import type { FilterChangeDetails, FilterQuery, FilterRule } from "../filters-types";

const OPEN_STATUS = createFilterRule({ id: "s", path: ["status"], operator: "is", value: "open" });
const NAME_CONTAINS = createFilterRule({ id: "n", path: ["name"], operator: "contains", value: "ann" });
const TWO_RULES = createFilterQuery([OPEN_STATUS, NAME_CONTAINS]);

type ChangeSpy = (query: FilterQuery, details: FilterChangeDetails) => void;

function lastChange(spy: ReturnType<typeof vi.fn<ChangeSpy>>): FilterQuery {
	const call = spy.mock.calls.at(-1);
	if (call === undefined) {
		throw new Error("no change emitted");
	}
	return call[LIST_SLOT_INDEX.first];
}

function chip(name: string): HTMLElement {
	return screen.getByRole("group", { name });
}

function rulesOf(query: FilterQuery): readonly FilterRule[] {
	return flattenFilterRules(query);
}

function renderChip(rule: FilterRule): React.ReactNode {
	return <span>{`custom ${rule.id}`}</span>;
}

beforeEach((): void => {
	stubFiltersDom();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Filters (basic chip row)", () => {
	it("renders one named chip per rule inside a labelled toolbar", (): void => {
		render(<FiltersHarness initialQuery={TWO_RULES} />);
		const toolbar = screen.getByRole("toolbar", { name: "Filters" });
		expect(within(toolbar).getByRole("group", { name: "Status is Open" })).toBeTruthy();
		expect(within(toolbar).getByRole("group", { name: "Name contains ann" })).toBeTruthy();
		// Exactly one chip holds the tab stop.
		expect(chip("Status is Open").tabIndex).toBe(0);
		expect(chip("Name contains ann").tabIndex).toBe(-1);
	});

	it("forwards its ref to the bar and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<FiltersHarness filtersRef={ref} className="custom-bar" />);
		expect(ref.current?.dataset.slot).toBe("filters");
		expect(ref.current?.className).toContain("custom-bar");
	});

	it("reads its copy from the label provider, overridable per bar", (): void => {
		const labels = { addFilter: "Ajouter un filtre" };
		render(<FiltersHarness labels={labels} />);
		expect(screen.getByRole("button", { name: "Ajouter un filtre" })).toBeTruthy();
	});

	it("re-words an operator through operatorLabels", (): void => {
		const operatorLabels = { contains: "includes" };
		render(<FiltersHarness initialQuery={TWO_RULES} operatorLabels={operatorLabels} />);
		expect(chip("Name includes ann")).toBeTruthy();
	});

	it("adds a filter: field picker, then the condition menu opens on the new chip", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
		fireEvent.click(screen.getByRole("option", { name: "Name" }));
		const added = rulesOf(lastChange(onChange));
		expect(added).toHaveLength(1);
		expect(added[LIST_SLOT_INDEX.first]).toMatchObject({ path: ["name"], operator: "" });
		expect(onChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.second].reason).toBe("add");
		// The new chip reads as unfinished and its condition menu is open.
		expect(screen.getByRole("group", { name: "Name Select condition, incomplete filter" })).toBeTruthy();
		fireEvent.click(screen.getByRole("option", { name: "starts with" }));
		expect(rulesOf(lastChange(onChange))[LIST_SLOT_INDEX.first]?.operator).toBe("starts_with");
	});

	it("drills into a nested field in the picker and searches deep", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
		fireEvent.click(screen.getByRole("option", { name: /Owner/u }));
		expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
		fireEvent.click(screen.getByRole("option", { name: "Email" }));
		expect(rulesOf(lastChange(onChange))[LIST_SLOT_INDEX.first]?.path).toEqual(["owner", "email"]);
	});

	it("edits a text value through its popover and commits on Enter", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} />);
		fireEvent.click(within(chip("Name contains ann")).getByRole("button", { name: "ann" }));
		const input = screen.getByRole("textbox", { name: "Name" });
		fireEvent.change(input, { target: { value: "bob" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(findFilterRule(lastChange(onChange), "n")?.value).toBe("bob");
	});

	it("picks several options, applying the exclusive None rule", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		const query = createFilterQuery([createFilterRule({ id: "m", path: ["status"], operator: "is_any_of", value: ["open"] })]);
		render(<FiltersHarness initialQuery={query} onChange={onChange} />);
		fireEvent.click(within(chip("Status is any of Open")).getByRole("button", { name: "Open" }));
		fireEvent.click(screen.getByRole("option", { name: "Closed" }));
		expect(findFilterRule(lastChange(onChange), "m")?.value).toEqual(["open", "closed"]);
		fireEvent.click(screen.getByRole("option", { name: /No status/u }));
		expect(findFilterRule(lastChange(onChange), "m")?.value).toEqual(["none"]);
	});

	it("removes the focused chip with Delete and moves it with Alt+Arrow", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} />);
		const first = chip("Status is Open");
		act((): void => {
			first.focus();
		});
		fireEvent.keyDown(first, { key: "ArrowRight", altKey: true });
		expect(rulesOf(lastChange(onChange)).map((rule: FilterRule): string => rule.id)).toEqual(["n", "s"]);
		fireEvent.keyDown(chip("Status is Open"), { key: "Delete" });
		expect(rulesOf(lastChange(onChange)).map((rule: FilterRule): string => rule.id)).toEqual(["n"]);
		expect(onChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.second].reason).toBe("remove");
	});

	it("walks chips with the arrow keys", (): void => {
		render(<FiltersHarness initialQuery={TWO_RULES} />);
		const first = chip("Status is Open");
		act((): void => {
			first.focus();
		});
		fireEvent.keyDown(first, { key: "ArrowRight" });
		expect(document.activeElement).toBe(chip("Name contains ann"));
		fireEvent.keyDown(chip("Name contains ann"), { key: "Home" });
		expect(document.activeElement).toBe(first);
	});

	it("duplicates and negates from the chip menu", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Name filter options" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Negate" }));
		expect(findFilterRule(lastChange(onChange), "n")?.operator).toBe("not_contains");
		fireEvent.click(screen.getByRole("button", { name: "Status filter options" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
		expect(rulesOf(lastChange(onChange))).toHaveLength(3);
	});

	it("clears every filter with the Clear button", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} showClear />);
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(lastChange(onChange).rules).toEqual([]);
		expect(screen.getByRole("status").textContent).toBe("0 filters applied");
	});

	it("vetoes a change through onBeforeQueryChange", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		const refuse = vi.fn((): boolean => false);
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} onBeforeQueryChange={refuse} showClear />);
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(refuse).toHaveBeenCalledTimes(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("keeps a read-only bar navigable but refuses every edit", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness initialQuery={TWO_RULES} onChange={onChange} readOnly showClear />);
		expect(screen.getByRole("button", { name: "Add filter" }).getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		const first = chip("Status is Open");
		fireEvent.keyDown(first, { key: "Delete" });
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("toolbar", { name: "Filters" }).getAttribute("aria-describedby")).not.toBeNull();
	});

	it("keeps a rule on an unknown field visible and removable", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		const query = createFilterQuery([createFilterRule({ id: "u", path: ["gone"], operator: "is", value: "x" })]);
		render(<FiltersHarness initialQuery={query} onChange={onChange} />);
		fireEvent.click(within(chip("gone")).getByRole("button", { name: "Remove" }));
		expect(lastChange(onChange).rules).toEqual([]);
	});

	it("renders a consumer chip through renderChip", (): void => {
		render(<FiltersHarness initialQuery={TWO_RULES} renderChip={renderChip} />);
		expect(screen.getByText("custom s")).toBeTruthy();
	});
});
