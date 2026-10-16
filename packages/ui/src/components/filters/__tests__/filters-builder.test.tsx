// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuContent } from "@workspace/ui/components/dropdown-menu";

import { Filters } from "../filters";
import { FilterFieldPicker, FiltersBuilder, type FilterFieldPickerAction } from "../filters-builder";
import { FilterChip, FilterRuleMenuItems, useFilterRuleDisplay } from "../filters-chip";
import { createFilterQuery, createFilterRule } from "../filters-query";
import { FILTER_FIXTURE_FIELDS, stubFiltersDom } from "@workspace/ui/testing/filters-test-utils";
import { UiKitTestProviders } from "../../../testing/ui-kit-test-providers";
import type { FilterQuery } from "../filters-types";

const EMPTY = createFilterQuery();

function noop(): void {
	return;
}

interface PickerHarnessProps {
	readonly onSelect: (path: readonly string[], defaultOperator: string | null) => void;
	readonly pickerRef?: React.Ref<HTMLDivElement> | undefined;
	readonly actions?: readonly FilterFieldPickerAction[] | undefined;
}

/** The picker is controlled: this parent owns the browse level and the query. */
function PickerHarness({ onSelect, pickerRef, actions }: PickerHarnessProps): React.JSX.Element {
	const [path, setPath] = React.useState<readonly string[]>([]);
	const [query, setQuery] = React.useState("");
	return (
		<UiKitTestProviders>
			<Filters fields={FILTER_FIXTURE_FIELDS} query={EMPTY} onQueryChange={noop}>
				<FilterFieldPicker
					ref={pickerRef}
					path={path}
					onPathChange={setPath}
					query={query}
					onQueryChange={setQuery}
					onSelect={onSelect}
					actions={actions}
					className="picker-x"
				/>
			</Filters>
		</UiKitTestProviders>
	);
}

beforeEach((): void => {
	stubFiltersDom();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("FilterFieldPicker", () => {
	it("lists the root level, names branches, and forwards ref and className", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<PickerHarness onSelect={noop} pickerRef={ref} />);
		expect(screen.getByRole("option", { name: "Owner, 1 items, opens a list" })).toBeTruthy();
		expect(ref.current?.dataset.slot).toBe("filter-field-picker");
		expect(ref.current?.className).toContain("picker-x");
	});

	it("drills in, climbs back with Backspace, and commits a leaf with its default operator", (): void => {
		const onSelect = vi.fn<(path: readonly string[], defaultOperator: string | null) => void>();
		render(<PickerHarness onSelect={onSelect} />);
		fireEvent.click(screen.getByRole("option", { name: /Owner/u }));
		expect(screen.getByText("Owner")).toBeTruthy();
		fireEvent.keyDown(screen.getByRole("combobox", { name: "Attributes" }), { key: "Backspace" });
		expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
		fireEvent.click(screen.getByRole("option", { name: "Age" }));
		expect(onSelect).toHaveBeenCalledWith(["age"], "eq");
	});

	it("searches every depth and announces the count", (): void => {
		const onSelect = vi.fn<(path: readonly string[], defaultOperator: string | null) => void>();
		render(<PickerHarness onSelect={onSelect} />);
		fireEvent.change(screen.getByRole("combobox", { name: "Attributes" }), { target: { value: "mail" } });
		expect(screen.getByRole("status").textContent).toBe("1 result");
		fireEvent.click(screen.getByRole("option", { name: /Email/u }));
		expect(onSelect).toHaveBeenCalledWith(["owner", "email"], "contains");
	});

	it("draws pinned footer actions out of the option ring", (): void => {
		const onAction = vi.fn<() => void>();
		const actions: readonly FilterFieldPickerAction[] = [{ value: "new", label: "Create field", onSelect: onAction }];
		render(<PickerHarness onSelect={noop} actions={actions} />);
		fireEvent.click(screen.getByRole("button", { name: "Create field" }));
		expect(onAction).toHaveBeenCalled();
	});
});

describe("FiltersBuilder and FilterChip composed by a consumer", () => {
	const QUERY: FilterQuery = createFilterQuery([createFilterRule({ id: "s", path: ["status"], operator: "is", value: "open" })]);

	function DisplayProbe(): React.JSX.Element {
		const rule = createFilterRule({ id: "s", path: ["status"], operator: "is", value: "open" });
		const display = useFilterRuleDisplay(rule, FILTER_FIXTURE_FIELDS.at(0), { value: "is", label: "is" });
		return <output>{`${display.pathText}|${display.operatorLabel}|${display.valueText}`}</output>;
	}

	it("renders the builder with a custom trigger, a chip and the display hook", (): void => {
		const builderRef = React.createRef<HTMLDivElement>();
		const chipRef = React.createRef<HTMLDivElement>();
		const trigger = <button type="button">More filters</button>;
		render(
			<UiKitTestProviders>
				<Filters fields={FILTER_FIXTURE_FIELDS} query={QUERY} onQueryChange={noop}>
					<FilterChip ref={chipRef} rule={createFilterRule({ id: "s", path: ["status"], operator: "is", value: "open" })} index={0} className="chip-x" />
					<FiltersBuilder ref={builderRef} trigger={trigger} />
					<DisplayProbe />
				</Filters>
			</UiKitTestProviders>,
		);
		expect(chipRef.current?.className).toContain("chip-x");
		expect(screen.getByText("Status|is|Open")).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "More filters" }));
		});
		expect(builderRef.current?.dataset.slot).toBe("popover-content");
	});

	it("exposes the rule menu items as a group with a ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<UiKitTestProviders>
				<Filters fields={FILTER_FIXTURE_FIELDS} query={QUERY} onQueryChange={noop}>
					<DropdownMenu open>
						<DropdownMenuContent>
							<FilterRuleMenuItems ref={ref} ruleId="s" />
						</DropdownMenuContent>
					</DropdownMenu>
				</Filters>
			</UiKitTestProviders>,
		);
		expect(ref.current?.getAttribute("role")).toBe("group");
		const names = screen.getAllByRole("menuitem").map((item: HTMLElement): string => item.textContent);
		expect(names).toEqual(["Duplicate", "Negate", "Remove"]);
	});
});
