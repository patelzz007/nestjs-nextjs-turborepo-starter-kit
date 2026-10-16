// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import {
	DEFAULT_FILTER_EDITORS,
	FilterBooleanEditor,
	FilterMenu,
	FilterMultiSelectEditor,
	FilterNumberEditor,
	filterOptionValues,
	FilterRangeEditor,
	FilterSelectEditor,
	FilterTextEditor,
	findFilterAutoFocusTarget,
	partitionFilterMenuItems,
	resolveFilterEditor,
	toggleFilterMenuSelection,
	useFilterOptions,
	type FilterListItem,
} from "../filters-editors";
import { stubFiltersDom } from "@workspace/ui/testing/filters-test-utils";
import {
	FILTER_AUTOFOCUS_PROPS,
	type FilterCommitOptions,
	type FilterEditor,
	type FilterEditorProps,
	type FilterField,
	type FilterLoadContext,
	type FilterOperator,
	type FilterOption,
	type FilterOptionsState,
	type FilterValue,
} from "../filters-types";

const LABELS = UI_KIT_LABELS_EN.filters;
const TEXT_FIELD: FilterField = { id: "name", label: "Name", type: "text" };
const OPTIONS: readonly FilterOption[] = [
	{ value: "open", label: "Open" },
	{ value: "closed", label: "Closed" },
	{ value: "none", label: "No status", exclusive: true },
];
const SELECT_FIELD: FilterField = { id: "status", label: "Status", type: "select", options: OPTIONS };
const IS: FilterOperator = { value: "is", label: "is" };
const BETWEEN: FilterOperator = { value: "between", label: "is between", arity: "range" };

function noop(): void {
	return;
}

function staticOptions(items: readonly FilterOption[]): FilterOptionsState {
	return {
		items,
		loading: false,
		error: false,
		hasMore: false,
		query: "",
		setQuery: noop,
		loadMore: noop,
		retry: noop,
		resolve: (value: string): FilterOption | undefined => items.find((option: FilterOption): boolean => option.value === value),
	};
}

interface EditorSpies {
	readonly onValueChange: ReturnType<typeof vi.fn<(value: FilterValue | undefined) => void>>;
	readonly commit: ReturnType<typeof vi.fn<(value?: FilterValue, options?: FilterCommitOptions) => void>>;
	readonly cancel: ReturnType<typeof vi.fn<() => void>>;
}

function spies(): EditorSpies {
	return {
		onValueChange: vi.fn<(value: FilterValue | undefined) => void>(),
		commit: vi.fn<(value?: FilterValue, options?: FilterCommitOptions) => void>(),
		cancel: vi.fn<() => void>(),
	};
}

function editorProps(field: FilterField, value: FilterValue | undefined, editorSpies: EditorSpies, operator: FilterOperator = IS): FilterEditorProps {
	return {
		field,
		operator,
		value,
		onValueChange: editorSpies.onValueChange,
		host: "amend",
		autoFocusProps: FILTER_AUTOFOCUS_PROPS,
		commit: editorSpies.commit,
		cancel: editorSpies.cancel,
		back: editorSpies.cancel,
		options: staticOptions(field.options ?? []),
		labels: LABELS,
	};
}

beforeEach((): void => {
	stubFiltersDom();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("text, number and range editors", () => {
	it("edits text, commits on Enter, cancels on Escape, and marks its autofocus target", (): void => {
		const editorSpies = spies();
		const ref = React.createRef<HTMLDivElement>();
		render(<FilterTextEditor ref={ref} {...editorProps({ ...TEXT_FIELD, className: "w-96" }, "ann", editorSpies)} />);
		const input = screen.getByRole("textbox", { name: "Name" });
		expect(findFilterAutoFocusTarget(ref.current)).toBe(input);
		expect(ref.current?.className).toContain("w-96");
		fireEvent.change(input, { target: { value: "bob" } });
		expect(editorSpies.onValueChange).toHaveBeenCalledWith("bob");
		fireEvent.keyDown(input, { key: "Enter" });
		expect(editorSpies.commit).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(input, { key: "Escape" });
		expect(editorSpies.cancel).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole("button", { name: LABELS.apply }));
		expect(editorSpies.commit).toHaveBeenCalledTimes(2);
	});

	it("parses numbers and clears an empty box", (): void => {
		const editorSpies = spies();
		render(<FilterNumberEditor {...editorProps({ id: "age", label: "Age", type: "number" }, 3, editorSpies)} />);
		const input = screen.getByRole("spinbutton", { name: "Age" });
		expect(input).toHaveProperty("value", "3");
		fireEvent.change(input, { target: { value: "42" } });
		expect(editorSpies.onValueChange).toHaveBeenLastCalledWith(42);
		fireEvent.change(input, { target: { value: "" } });
		expect(editorSpies.onValueChange).toHaveBeenLastCalledWith(undefined);
	});

	it("edits both ends of a range", (): void => {
		const editorSpies = spies();
		render(<FilterRangeEditor {...editorProps({ id: "age", label: "Age", type: "number" }, [1, 9], editorSpies, BETWEEN)} />);
		fireEvent.change(screen.getByRole("spinbutton", { name: "Age from" }), { target: { value: "2" } });
		expect(editorSpies.onValueChange).toHaveBeenLastCalledWith([2, 9]);
		fireEvent.change(screen.getByRole("spinbutton", { name: "Age to" }), { target: { value: "" } });
		expect(editorSpies.onValueChange).toHaveBeenLastCalledWith([1, null]);
		fireEvent.click(screen.getByRole("button", { name: LABELS.discard }));
		expect(editorSpies.cancel).toHaveBeenCalled();
	});
});

describe("option and boolean editors", () => {
	it("commits a single pick and closes", (): void => {
		const editorSpies = spies();
		render(<FilterSelectEditor {...editorProps(SELECT_FIELD, undefined, editorSpies)} />);
		fireEvent.click(screen.getByRole("option", { name: "Closed" }));
		expect(editorSpies.commit).toHaveBeenCalledWith("closed");
	});

	it("toggles several picks without closing, and lets None clear the rest", (): void => {
		const editorSpies = spies();
		const { rerender } = render(<FilterMultiSelectEditor {...editorProps(SELECT_FIELD, ["open"], editorSpies)} />);
		expect(screen.getByRole("option", { name: "Open" }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(screen.getByRole("option", { name: "Closed" }));
		expect(editorSpies.commit).toHaveBeenLastCalledWith(["open", "closed"], { close: false });
		rerender(<FilterMultiSelectEditor {...editorProps(SELECT_FIELD, ["open", "closed"], editorSpies)} />);
		fireEvent.click(screen.getByRole("option", { name: /No status/u }));
		expect(editorSpies.commit).toHaveBeenLastCalledWith(["none"], { close: false });
	});

	it("reads boolean words from the labels", (): void => {
		const editorSpies = spies();
		render(<FilterBooleanEditor {...editorProps({ id: "active", label: "Active", type: "boolean" }, true, editorSpies)} />);
		expect(screen.getByRole("option", { name: LABELS.booleanTrue }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(screen.getByRole("option", { name: LABELS.booleanFalse }));
		expect(editorSpies.commit).toHaveBeenCalledWith(false);
	});
});

describe("FilterMenu", () => {
	const ITEMS: readonly FilterListItem[] = [
		{ value: "b", label: "Beta" },
		{ value: "a", label: "Alpha", keywords: ["first"] },
		{ value: "x", label: "None", exclusive: true },
	];

	it("filters by label and keyword, and announces the count", (): void => {
		const onSelectionChange = vi.fn<(values: readonly string[]) => void>();
		render(<FilterMenu items={ITEMS} selected={[]} onSelectionChange={onSelectionChange} labels={LABELS} ariaLabel="Letters" />);
		fireEvent.change(screen.getByRole("combobox", { name: "Letters" }), { target: { value: "first" } });
		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Alpha"]);
		expect(screen.getByRole("status").textContent).toBe("1 result");
	});

	it("shows paging and error affordances in its footer", (): void => {
		const retry = vi.fn<() => void>();
		const state = { loading: false, error: true, hasMore: false, loadMore: noop, retry };
		render(<FilterMenu items={[]} selected={[]} onSelectionChange={noop} labels={LABELS} ariaLabel="Letters" state={state} />);
		expect(screen.getByText(LABELS.error)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: LABELS.retry }));
		expect(retry).toHaveBeenCalled();
	});

	it("forwards its ref and merges className", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<FilterMenu ref={ref} items={ITEMS} selected={[]} onSelectionChange={noop} labels={LABELS} ariaLabel="Letters" className="menu-x" />);
		expect(ref.current?.dataset.slot).toBe("filter-menu");
		expect(ref.current?.className).toContain("menu-x");
	});

	it("partitions pinned picks, the rest, and exclusive rows", (): void => {
		const pinned = partitionFilterMenuItems(ITEMS, new Set(["a"]), "none");
		expect(pinned.rows.map((item: FilterListItem): string => item.value)).toEqual(["a", "b", "x"]);
		expect(pinned.pinDividerAt).toBe(1);
		expect(pinned.exclusiveAt).toBe(2);
		expect(partitionFilterMenuItems(ITEMS, new Set(), "label").rows.map((item: FilterListItem): string => item.value)).toEqual(["a", "b", "x"]);
	});

	it("toggles a selection purely", (): void => {
		expect(toggleFilterMenuSelection(["a"], "b", true)).toEqual(["a", "b"]);
		expect(toggleFilterMenuSelection(["a", "b"], "a", true)).toEqual(["b"]);
		expect(toggleFilterMenuSelection(["a"], "a", false)).toEqual([]);
		expect(toggleFilterMenuSelection([], "a", false)).toEqual(["a"]);
	});
});

describe("useFilterOptions", () => {
	it("filters static options by query and resolves values", (): void => {
		const { result } = renderHook((): FilterOptionsState => useFilterOptions(SELECT_FIELD, true));
		act((): void => {
			result.current.setQuery("clo");
		});
		expect(result.current.items.map((option: FilterOption): string => option.value)).toEqual(["closed"]);
		expect(result.current.resolve("open")?.label).toBe("Open");
	});

	it("loads, pages and recovers from an error", async (): Promise<void> => {
		const loadOptions = vi.fn(async (query: string, context: FilterLoadContext): Promise<{ items: readonly FilterOption[]; nextCursor?: string }> => {
			await Promise.resolve();
			if (query === "fail") {
				throw new Error("boom");
			}
			return context.cursor === undefined ? { items: [{ value: "1", label: "One" }], nextCursor: "c" } : { items: [{ value: "2", label: "Two" }] };
		});
		const field: FilterField = { id: "remote", label: "Remote", type: "select", loadOptions };
		const { result } = renderHook((): FilterOptionsState => useFilterOptions(field, true, 0));
		await waitFor((): void => {
			expect(result.current.items).toHaveLength(1);
		});
		expect(result.current.hasMore).toBe(true);
		act((): void => {
			result.current.loadMore();
		});
		await waitFor((): void => {
			expect(result.current.items.map((option: FilterOption): string => option.value)).toEqual(["1", "2"]);
		});
		act((): void => {
			result.current.setQuery("fail");
		});
		await waitFor((): void => {
			expect(result.current.error).toBe(true);
		});
		expect(loadOptions.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]).toBe("fail");
	});
});

describe("editor resolution", () => {
	function CustomEditor(): React.JSX.Element {
		return <span>custom</span>;
	}
	const custom: FilterEditor = CustomEditor;

	it("picks the field's editor, then arity, then type", (): void => {
		expect(resolveFilterEditor({ ...TEXT_FIELD, editor: custom }, IS, DEFAULT_FILTER_EDITORS)).toBe(custom);
		expect(resolveFilterEditor({ ...TEXT_FIELD, editor: "date" }, IS, { ...DEFAULT_FILTER_EDITORS, date: custom })).toBe(custom);
		expect(resolveFilterEditor(TEXT_FIELD, BETWEEN, DEFAULT_FILTER_EDITORS)).toBe(FilterRangeEditor);
		expect(resolveFilterEditor(SELECT_FIELD, { value: "any", label: "any", arity: "many" }, DEFAULT_FILTER_EDITORS)).toBe(FilterMultiSelectEditor);
		expect(resolveFilterEditor(TEXT_FIELD, { value: "empty", label: "empty", arity: "none" }, DEFAULT_FILTER_EDITORS)).toBeUndefined();
		expect(resolveFilterEditor({ id: "x", label: "X" }, IS, DEFAULT_FILTER_EDITORS)).toBe(FilterTextEditor);
	});

	it("reads option values from any stored shape", (): void => {
		expect(filterOptionValues(["a", 2, null, true])).toEqual(["a", "2", "true"]);
		expect(filterOptionValues(undefined)).toEqual([]);
	});
});
