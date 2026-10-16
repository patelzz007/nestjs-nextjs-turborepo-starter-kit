// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canFilterNodeMove } from "./filters-advanced";
import { filterMoveDestinations } from "./filters-chip";
import { createFilterGroup, createFilterQuery, createFilterRule, findFilterNode, findFilterRule, flattenFilterRules } from "./filters-query";
import { FiltersHarness, stubFiltersDom } from "@workspace/ui/testing/filters-test-utils";
import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import type { FilterChangeDetails, FilterEmptyStateContext, FilterNode, FilterQuery, FilterRule } from "./filters-types";

type ChangeSpy = (query: FilterQuery, details: FilterChangeDetails) => void;

const STATUS = createFilterRule({ id: "s", path: ["status"], operator: "is", value: "open" });
const NAME = createFilterRule({ id: "n", path: ["name"], operator: "contains", value: "ann" });
const AGE = createFilterRule({ id: "a", path: ["age"], operator: "gt", value: 3 });
const NESTED = createFilterQuery([STATUS, createFilterGroup({ id: "g", combinator: "or", rules: [NAME, AGE] })]);

function lastChange(spy: ReturnType<typeof vi.fn<ChangeSpy>>): FilterQuery {
	const call = spy.mock.calls.at(-1);
	if (call === undefined) {
		throw new Error("no change emitted");
	}
	return call[LIST_SLOT_INDEX.first];
}

function idsOf(nodes: readonly FilterNode[]): string[] {
	return nodes.map((node: FilterNode): string => node.id);
}

function renderEmpty(context: FilterEmptyStateContext): React.ReactNode {
	return (
		<button type="button" onClick={context.addFilter}>
			{`Start (${context.mode})`}
		</button>
	);
}

beforeEach((): void => {
	stubFiltersDom();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("FiltersAdvancedPanel (inline)", () => {
	it("draws rows and nested groups with depth in their names", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<FiltersHarness filtersRef={ref} variant="advanced" advancedMode="inline" initialQuery={NESTED} className="panel-x" />);
		const panel = screen.getByRole("group", { name: "Advanced filter" });
		expect(ref.current).toBe(panel);
		expect(panel.className).toContain("panel-x");
		expect(within(panel).getByRole("group", { name: "Status is, level 1" })).toBeTruthy();
		expect(within(panel).getByRole("group", { name: "Any of the following are true… level 1" })).toBeTruthy();
		expect(within(panel).getByRole("group", { name: "Name contains, level 2" })).toBeTruthy();
		expect(within(panel).getAllByText("Where")).toHaveLength(2);
	});

	it("toggles the root combinator and a group's combinator", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "And, change combinator" }));
		expect(lastChange(onChange).combinator).toBe("or");
		fireEvent.click(screen.getByRole("button", { name: "Any of the following are true…, change combinator" }));
		const group = findFilterNode(lastChange(onChange), "g")?.node;
		expect(group?.type === "group" ? group.combinator : null).toBe("and");
	});

	it("adds a condition that starts pending on its attribute picker", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" onChange={onChange} />);
		expect(screen.getByText(UI_KIT_LABELS_EN.filters.builderEmpty)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
		const [added] = flattenFilterRules(lastChange(onChange));
		expect(added).toMatchObject({ path: ["status"], operator: "" });
		// Pending: the row shows only its attribute cell, with the picker open.
		fireEvent.click(screen.getByRole("option", { name: "Age" }));
		const [picked] = flattenFilterRules(lastChange(onChange));
		expect(picked).toMatchObject({ path: ["age"], operator: "" });
	});

	it("adds and removes a group, and adds into a group", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Add group" }));
		expect(lastChange(onChange).rules).toHaveLength(3);
		expect(screen.getByText("Drag filters here")).toBeTruthy();
		const [firstGroupAdd] = screen.getAllByRole("button", { name: "Add filter to this group" });
		if (firstGroupAdd === undefined) {
			throw new Error("no group add button");
		}
		fireEvent.click(firstGroupAdd);
		const group = findFilterNode(lastChange(onChange), "g")?.node;
		expect(group?.type === "group" ? group.rules.length : 0).toBe(3);
	});

	it("ungroups and removes a group from its menu", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Group options" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Ungroup" }));
		expect(idsOf(lastChange(onChange).rules)).toEqual(["s", "n", "a"]);
	});

	it("wraps a row in a group from the row menu", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Status filter options" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Wrap in group" }));
		expect(lastChange(onChange).rules[LIST_SLOT_INDEX.first]?.type).toBe("group");
	});

	it("reorders with Alt+Arrow only when reorderable, and draws grips", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		const { rerender } = render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} />);
		const fieldCell = screen.getByRole("button", { name: "Status" });
		fireEvent.keyDown(fieldCell, { key: "ArrowDown", altKey: true });
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.queryAllByRole("button", { name: /^Reorder/u })).toHaveLength(0);
		rerender(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} reorderable />);
		expect(screen.getAllByRole("button", { name: /^Reorder/u }).length).toBeGreaterThan(0);
		fireEvent.keyDown(screen.getByRole("button", { name: "Status" }), { key: "ArrowDown", altKey: true });
		expect(idsOf(lastChange(onChange).rules)).toEqual(["g", "s"]);
		expect(screen.getByRole("status").textContent).toBe("Status moved to position 2 of 2");
	});

	it("walks cells with the arrow keys", (): void => {
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} />);
		const field = screen.getByRole("button", { name: "Status" });
		act((): void => {
			field.focus();
		});
		fireEvent.keyDown(field, { key: "ArrowRight" });
		expect(document.activeElement?.getAttribute("data-filter-cell")).toBe("operator");
		fireEvent.keyDown(document.activeElement ?? field, { key: "ArrowDown" });
		expect(document.activeElement?.getAttribute("data-filter-cell")).not.toBeNull();
	});

	it("shows an issue only after the user commits a value, and sums them", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		const query = createFilterQuery([createFilterRule({ id: "r", path: ["age"], operator: "between", value: [5, 9] })]);
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={query} onChange={onChange} />);
		expect(screen.queryByRole("button", { name: /needs attention/u })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /^Age:/u }));
		fireEvent.change(screen.getByRole("spinbutton", { name: "Age from" }), { target: { value: "20" } });
		fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		const committed: FilterRule | null = findFilterRule(lastChange(onChange), "r");
		expect(committed?.value).toEqual([20, 9]);
		expect(screen.getByRole("button", { name: "1 row needs attention" })).toBeTruthy();
		expect(screen.getByRole("button", { name: /^Age:/u }).getAttribute("aria-invalid")).toBe("true");
	});

	it("renders a consumer empty state with the footer's actions", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" renderEmpty={renderEmpty} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Start (inline)" }));
		expect(flattenFilterRules(lastChange(onChange))).toHaveLength(1);
	});

	it("refuses edits while read only", (): void => {
		const onChange = vi.fn<ChangeSpy>();
		render(<FiltersHarness variant="advanced" advancedMode="inline" initialQuery={NESTED} onChange={onChange} readOnly />);
		fireEvent.click(screen.getByRole("button", { name: "Add group" }));
		fireEvent.click(screen.getByRole("button", { name: "And, change combinator" }));
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe("FiltersAdvanced (popover)", () => {
	it("opens the panel from its trigger with a rule count", (): void => {
		render(<FiltersHarness variant="advanced" initialQuery={NESTED} />);
		fireEvent.click(screen.getByRole("button", { name: "Advanced filter, 3 filters applied" }));
		expect(screen.getByRole("group", { name: "Advanced filter" })).toBeTruthy();
	});
});

describe("advanced helpers", () => {
	it("knows when a node has nowhere to move", (): void => {
		const lone = createFilterQuery([STATUS]);
		expect(canFilterNodeMove(lone, { parentId: "root" })).toBe(false);
		expect(canFilterNodeMove(NESTED, { parentId: "root" })).toBe(true);
		expect(canFilterNodeMove(lone, { parentId: "g" })).toBe(true);
	});

	it("numbers move destinations and never offers a cycle", (): void => {
		const labels = UI_KIT_LABELS_EN.filters;
		expect(filterMoveDestinations(NESTED, "s", labels).map((entry): string => entry.label)).toEqual(["Move to group 1"]);
		expect(filterMoveDestinations(NESTED, "n", labels).map((entry): string => entry.label)).toEqual(["Move to top"]);
		expect(filterMoveDestinations(NESTED, "g", labels).map((entry): string => entry.id)).toEqual([]);
	});
});
