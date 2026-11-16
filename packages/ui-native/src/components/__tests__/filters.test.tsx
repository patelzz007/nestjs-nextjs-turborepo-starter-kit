import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createFilterGroup, createFilterQuery, createFilterRule, type FilterOperator, type FilterQuery } from "@workspace/ui-kit-logic";
import CircleIcon from "lucide-react-native/icons/circle";
import * as React from "react";
import { AccessibilityInfo, Text, type ViewInstance } from "react-native";

import { DEFAULT_FILTER_LABELS, filterBarFieldAt, filterBarPathLabel, filterBarValueText, type FilterBarEditorProps, type FilterBarField } from "../../lib/filters";
import { SHEET_MOTION } from "../../lib/motion";
import { Filters, type FilterBarChangeDetails, type FiltersProps } from "../filters";

const FIELDS: readonly FilterBarField[] = [
	{
		id: "status",
		label: "Status",
		type: "select",
		icon: CircleIcon,
		options: [
			{ value: "open", label: "Open", icon: CircleIcon },
			{ value: "closed", label: "Closed" },
			{ value: "archived", label: "Archived", disabled: true },
		],
	},
	{
		id: "assignee",
		label: "Assignee",
		type: "multiselect",
		options: [
			{ value: "ada", label: "Ada", leading: <Text>A</Text> },
			{ value: "alan", label: "Alan" },
			{ value: "none", label: "Unassigned", exclusive: true },
		],
	},
	{ id: "title", label: "Title", type: "text", placeholder: "Words in the title" },
	{ id: "spend", label: "Spend", type: "number", unit: "/mo", validate: (value): string | null => (value === -1 ? "Too low" : null) },
	{ id: "score", label: "Score", type: "range" },
	{ id: "vip", label: "VIP", type: "boolean" },
	{ id: "address", label: "Address", fields: [{ id: "city", label: "City", type: "text", description: "Where they live" }] },
	{ id: "hidden", label: "Hidden", disabled: true },
];

const NOW = new Date(2026, 5, 17);

function bar(overrides: Partial<FiltersProps> = {}): React.JSX.Element {
	return <Filters fields={FIELDS} query={createFilterQuery()} onQueryChange={jest.fn()} now={NOW} testID="filters" {...overrides} />;
}

/** A filter bar that keeps its own query, reporting each change. */
function Controlled({
	initial,
	onChange,
	mode,
}: {
	readonly initial?: FilterQuery;
	readonly onChange?: (query: FilterQuery, details: FilterBarChangeDetails) => void;
	readonly mode?: "bar" | "builder";
}): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(initial ?? createFilterQuery());
	const handleChange = React.useCallback(
		(next: FilterQuery, details: FilterBarChangeDetails): void => {
			setQuery(next);
			onChange?.(next, details);
		},
		[onChange],
	);
	return <Filters fields={FIELDS} query={query} onQueryChange={handleChange} now={NOW} mode={mode} />;
}

async function settle(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

/** Opens "Add filter" and picks a field (and a nested one under it). */
async function addFilter(...path: readonly string[]): Promise<void> {
	await fireEvent.press(screen.getByRole("button", { name: "Add filter" }));
	for (const label of path) {
		await fireEvent.press(screen.getByRole("button", { name: label }));
	}
}

beforeEach((): void => {
	jest.useFakeTimers();
	jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
});

afterEach((): void => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("the filter bar's lib", () => {
	it("finds a field by its path and names the path", () => {
		expect(filterBarFieldAt(FIELDS, ["address", "city"])?.label).toBe("City");
		expect(filterBarFieldAt(FIELDS, ["nope"])).toBeUndefined();
		expect(filterBarPathLabel(FIELDS, ["address", "city"], " › ")).toBe("Address › City");
		expect(filterBarPathLabel(FIELDS, ["address", "zip"], " › ")).toBe("address › zip");
	});

	it("writes a value as words: options, counts, ranges, units, booleans, dates and no value", () => {
		const [status, assignee, , spend] = FIELDS;
		const one: FilterOperator = { value: "is", label: "is" };
		const range: FilterOperator = { value: "between", label: "is between", arity: "range" };
		expect(filterBarValueText(undefined, status, one, DEFAULT_FILTER_LABELS, NOW)).toBe("");
		expect(filterBarValueText("open", status, one, DEFAULT_FILTER_LABELS, NOW)).toBe("Open");
		expect(filterBarValueText(["ada", "alan", "none"], assignee, one, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.valueCount(3));
		expect(filterBarValueText(["ada", "alan"], assignee, one, DEFAULT_FILTER_LABELS, NOW)).toBe("Ada, Alan");
		expect(filterBarValueText(40, spend, one, DEFAULT_FILTER_LABELS, NOW)).toBe("40/mo");
		expect(filterBarValueText([1, 5], undefined, range, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.valueRange("1", "5"));
		expect(filterBarValueText(true, undefined, one, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.booleanTrue);
		expect(filterBarValueText(false, undefined, one, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.booleanFalse);
		expect(filterBarValueText([null], undefined, one, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.noValue);
		expect(filterBarValueText({ relative: { unit: "day", offset: 0 } }, undefined, one, DEFAULT_FILTER_LABELS, NOW)).toBe(
			DEFAULT_FILTER_LABELS.relativeDate({ unit: "day", offset: 0 }),
		);
		expect(filterBarValueText("x", { id: "c", label: "C", valueText: (): string => "custom" }, one, DEFAULT_FILTER_LABELS, NOW)).toBe("custom");
	});
});

describe("Filters", () => {
	it("adds a select filter: field, operator, value, then a chip named by its condition", async () => {
		const onChange = jest.fn();
		await render(<Controlled onChange={onChange} />);

		await addFilter("Status");
		expect(screen.getByRole("radio", { name: "Archived" })).toHaveProp("accessibilityState", { selected: false, disabled: true });
		await fireEvent.press(screen.getByRole("radio", { name: "Open" }));
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();

		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ rules: [expect.objectContaining({ path: ["status"], operator: "is", value: "open" })] }),
			expect.objectContaining({ reason: "add" }),
		);
		expect(screen.getByRole("button", { name: DEFAULT_FILTER_LABELS.filterLabel("Status is Open") })).toBeOnTheScreen();
	});

	it("picks several values, clearing the others for an exclusive one", async () => {
		await render(<Controlled />);
		await addFilter("Assignee");
		await fireEvent.press(screen.getByRole("checkbox", { name: "Ada" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Alan" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Ada" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Unassigned" }));
		expect(screen.getByRole("checkbox", { name: "Alan" })).not.toBeChecked();
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(screen.getByRole("button", { name: /^Assignee has any of Unassigned$/u })).toBeOnTheScreen();
	});

	it("types a text, a number with its unit, keywords one per line, and a range", async () => {
		await render(<Controlled />);
		await addFilter("Title");
		await fireEvent.changeText(screen.getByLabelText("Title"), "launch");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();

		await addFilter("Spend");
		await fireEvent.changeText(screen.getByLabelText("Spend"), "40");
		await fireEvent.changeText(screen.getByLabelText("Spend"), "abc");
		await fireEvent.changeText(screen.getByLabelText("Spend"), "-1");
		expect(screen.getByRole("alert")).toHaveTextContent("Too low");
		await fireEvent.changeText(screen.getByLabelText("Spend"), "40");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(screen.getByRole("button", { name: /^Spend .* 40\/mo$/u })).toBeOnTheScreen();

		await addFilter("Score");
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.rangeFrom("Score")), "1");
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.rangeTo("Score")), "5");
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.rangeFrom("Score")), "");
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.rangeTo("Score")), "");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(screen.getAllByRole("button", { name: /^Remove /u })).toHaveLength(3);
	});

	it("switches the operator, keeping a value of the same kind and dropping one that no longer fits", async () => {
		await render(<Controlled />);
		await addFilter("Title");
		await fireEvent.changeText(screen.getByLabelText("Title"), "launch");
		await fireEvent.press(screen.getByRole("button", { name: "contains" }));
		await fireEvent.press(screen.getByRole("radio", { name: "starts with" }));
		await settle();
		expect(screen.getByDisplayValue("launch")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "starts with" }));
		await fireEvent.press(screen.getByRole("radio", { name: "is empty" }));
		await settle();
		expect(screen.queryByLabelText("Title")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
	});

	it("drills into a branch, steps back out, and picks a nested field", async () => {
		await render(<Controlled />);
		await addFilter("Address");
		expect(screen.getByRole("button", { name: "City" })).toHaveProp("accessibilityHint", "Where they live");
		await fireEvent.press(screen.getByRole("button", { name: `${DEFAULT_FILTER_LABELS.back}: Address` }));
		await fireEvent.press(screen.getByRole("button", { name: "Address" }));
		await fireEvent.press(screen.getByRole("button", { name: "City" }));
		await fireEvent.changeText(screen.getByLabelText("City"), "Oslo");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(screen.getByRole("button", { name: DEFAULT_FILTER_LABELS.filterLabel(`Address${DEFAULT_FILTER_LABELS.pathSeparator}City contains Oslo`) })).toBeOnTheScreen();
	});

	it("edits a chip, removes it from its sheet or its own button, clears all, and switches All / Any", async () => {
		const onChange = jest.fn();
		const initial = createFilterQuery([
			createFilterRule({ id: "r1", path: ["vip"], operator: "is", value: true }),
			createFilterRule({ id: "r2", path: ["title"], operator: "contains" }),
		]);
		await render(<Controlled initial={initial} onChange={onChange} />);

		expect(screen.getByRole("button", { name: /^VIP/u })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: /^Title contains/u }));
		expect(screen.getByRole("button", { name: "Remove" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
		await settle();
		expect(onChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: "remove" }));

		await fireEvent.press(screen.getByRole("button", { name: /^VIP/u }));
		await fireEvent.press(screen.getByRole("radio", { name: DEFAULT_FILTER_LABELS.booleanFalse }));
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(onChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: "update" }));

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_FILTER_LABELS.clearAll }));
		expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rules: [] }), expect.objectContaining({ reason: "clear" }));
	});

	it("joins two or more filters with All or Any, and removes one by its button", async () => {
		const onChange = jest.fn();
		const initial = createFilterQuery([
			createFilterRule({ id: "r1", path: ["status"], operator: "is", value: "open" }),
			createFilterRule({ id: "r2", path: ["status"], operator: "is_not", value: "closed", negated: true }),
		]);
		await render(<Controlled initial={initial} onChange={onChange} />);
		await fireEvent.press(screen.getByRole("radio", { name: DEFAULT_FILTER_LABELS.groupAny }));
		expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ combinator: "or" }), expect.objectContaining({ reason: "combinator" }));
		await fireEvent.press(screen.getAllByRole("button", { name: /^Remove /u }).at(0) ?? screen.getByTestId("missing"));
		expect(onChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: "remove" }));
	});

	it("shows chips without controls when read-only, and an unknown operator as written", async () => {
		const query = createFilterQuery([createFilterRule({ id: "r1", path: ["status"], operator: "mystery", value: "open" })]);
		await render(bar({ query, readOnly: true, size: "sm" }));
		expect(screen.queryByRole("button", { name: "Add filter" })).toBeNull();
		expect(screen.getByRole("button", { name: /Status mystery Open/u })).toHaveProp("accessibilityHint", DEFAULT_FILTER_LABELS.incomplete);
	});

	it("lays the query out as nested groups in builder mode, adding and removing rules and groups", async () => {
		const onChange = jest.fn();
		const initial = createFilterQuery([
			createFilterRule({ id: "r1", path: ["title"], operator: "contains", value: "a" }),
			createFilterGroup({ id: "g1", combinator: "or", rules: [] }),
		]);
		await render(<Controlled initial={initial} onChange={onChange} mode="builder" />);

		expect(screen.getByText(DEFAULT_FILTER_LABELS.builderEmpty)).toBeOnTheScreen();
		await fireEvent.press(screen.getAllByRole("button", { name: DEFAULT_FILTER_LABELS.addConditionGroup }).at(0) ?? screen.getByTestId("missing"));
		expect(onChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: "add", rule: null }));

		const addInGroup = screen.getAllByRole("button", { name: DEFAULT_FILTER_LABELS.addCondition }).at(1) ?? screen.getByTestId("missing");
		await fireEvent.press(addInGroup);
		await fireEvent.press(screen.getByRole("button", { name: "VIP" }));
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();

		await fireEvent.press(screen.getAllByRole("button", { name: DEFAULT_FILTER_LABELS.removeGroup }).at(0) ?? screen.getByTestId("missing"));
		expect(onChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: "remove" }));
	});

	it("uses a field's own editor, and closes the sheet without a change", async () => {
		function Stars({ onValueChange }: FilterBarEditorProps): React.JSX.Element {
			const pick = React.useCallback((): void => {
				onValueChange(5);
			}, [onValueChange]);
			return <Text onPress={pick}>five stars</Text>;
		}
		const onQueryChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(
			<Filters
				ref={ref}
				fields={[{ id: "rating", label: "Rating", type: "number", editor: Stars }]}
				query={createFilterQuery()}
				onQueryChange={onQueryChange}
				disabled={false}
				className="mt-2"
				testID="filters"
			/>,
		);
		await addFilter("Rating");
		await fireEvent.press(screen.getByText("five stars"));
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ value: 5 })] }), expect.anything());

		await addFilter();
		await fireEvent.press(screen.getByRole("button", { name: /close/iu }));
		await settle();
		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("filters")).toHaveProp("className", expect.stringContaining("mt-2"));
	});

	it("finds a field at any depth by its label or keywords, and says when nothing matches", async () => {
		const fields: readonly FilterBarField[] = [...FIELDS, { id: "loc", label: "Location", fields: [{ id: "postcode", label: "Postcode", keywords: ["zip"] }] }];
		const onQueryChange = jest.fn();
		await render(<Filters fields={fields} query={createFilterQuery()} onQueryChange={onQueryChange} />);
		await addFilter();
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.searchFields), "zip");
		await fireEvent.press(screen.getByRole("button", { name: `Location${DEFAULT_FILTER_LABELS.pathSeparator}Postcode` }));
		await fireEvent.changeText(screen.getByLabelText("Postcode"), "0150");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ path: ["loc", "postcode"] })] }), expect.anything());

		await addFilter();
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.searchFields), "nothing like it");
		expect(screen.getByText(DEFAULT_FILTER_LABELS.empty)).toBeOnTheScreen();
	});

	it("loads options as the person searches, with an error and a retry, and names stored ids it has not loaded", async () => {
		const people = [
			{ value: "u1", label: "Grace" },
			{ value: "u2", label: "Linus" },
		];
		let fail = true;
		const loadOptions = jest.fn((query: string): Promise<readonly { readonly value: string; readonly label: string }[]> => {
			if (fail) {
				fail = false;
				return Promise.reject(new Error("offline"));
			}
			return Promise.resolve(people.filter((person): boolean => person.label.toLowerCase().includes(query.toLowerCase())));
		});
		const resolveValues = jest.fn((values: readonly string[]): Promise<readonly { readonly value: string; readonly label: string }[]> =>
			Promise.resolve(people.filter((person): boolean => values.includes(person.value))),
		);
		const fields: readonly FilterBarField[] = [{ id: "owner", label: "Owner", type: "multiselect", loadOptions, resolveValues }];
		const stored = createFilterQuery([createFilterRule({ id: "r1", path: ["owner"], operator: "has_any_of", value: ["u2", "u9"] })]);
		const onQueryChange = jest.fn();
		await render(<Filters fields={fields} query={stored} onQueryChange={onQueryChange} />);
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByRole("button", { name: "Owner has any of Linus, u9" })).toBeOnTheScreen();

		await addFilter("Owner");
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByText(DEFAULT_FILTER_LABELS.error)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_FILTER_LABELS.retry }));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.searchOptions), "gra");
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		await fireEvent.press(screen.getByRole("checkbox", { name: "Grace" }));
		await fireEvent.changeText(screen.getByLabelText(DEFAULT_FILTER_LABELS.searchOptions), "zz");
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByText(DEFAULT_FILTER_LABELS.empty)).toBeOnTheScreen();
		expect(resolveValues).toHaveBeenCalledTimes(1);
	});
});
