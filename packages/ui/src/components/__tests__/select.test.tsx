// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Select,
	SelectChip,
	SelectChips,
	SelectClear,
	SelectClearAll,
	SelectContent,
	SelectEmpty,
	SelectItem,
	SelectTrigger,
	SelectValue,
	type SelectLabels,
	type SelectOption,
} from "./select";
import { describeSelection, resolveSelectOptionLabel } from "./select-context";
import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

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

const FRENCH_LABELS: SelectLabels = {
	clearSelection: "Effacer",
	clearAll: "Tout effacer",
	moreSelected: "Autres options",
	removeOption: (value: string): string => `Retirer ${value}`,
	loading: "Chargement…",
	empty: "Aucune option",
	nothingSelected: "Rien de sélectionné",
	selectedOne: (label: string): string => `${label} sélectionné`,
	selectedMany: (count: number, labels: string): string => `${count.toString()} sélectionnés : ${labels}`,
};

/** A Select with no options — for tests that only exercise copy/refs. */
const NO_OPTIONS: readonly SelectOption<string>[] = [];

const SINGLE_OPTION: readonly SelectOption<string>[] = [{ value: "a", label: "A" }];

/** Enum-style values whose raw form must never reach the trigger. */
const SCOPE_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "ALL_LOCATIONS", label: "All stores" },
	{ value: "SELECTED", label: "Selected stores only" },
];

/** Stable no-op handler (rule 16: no inline arrows in props). */
function noop(): void {
	return;
}

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Select labels", () => {
	it("routes every part's copy through the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select items={NO_OPTIONS} labels={FRENCH_LABELS} loading open>
				<SelectTrigger>
					<SelectChips maxChips={1}>
						<SelectChip value="a" label="A" onRemove={noop} />
						<SelectChip value="b" label="B" onRemove={noop} />
					</SelectChips>
					<SelectClear onClear={noop} />
				</SelectTrigger>
				<SelectContent>
					<SelectEmpty />
				</SelectContent>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Retirer a" })).toBeTruthy();
		expect(screen.getByLabelText("Autres options").textContent).toBe("+1");
		expect(screen.getByText("Chargement…")).toBeTruthy();
		expect(screen.getByText("Aucune option")).toBeTruthy();
	});

	it("lets a part-level prop override the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select items={NO_OPTIONS} labels={FRENCH_LABELS}>
				<SelectTrigger>
					<SelectValue />
					<SelectClear ariaLabel="Reset language" onClear={noop} />
				</SelectTrigger>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Reset language" })).toBeTruthy();
	});

	it("reads the provider's select copy outside a Select (clear-all lives beside the trigger)", (): void => {
		render(<SelectClearAll onClearAll={noop} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.select.clearAll })).toBeTruthy();
	});

	it("describes selections for the live region with the supplied labels", (): void => {
		expect(describeSelection(null, SCOPE_OPTIONS, undefined, FRENCH_LABELS)).toBe("Rien de sélectionné");
		expect(describeSelection("ALL_LOCATIONS", SCOPE_OPTIONS, undefined, FRENCH_LABELS)).toBe("All stores sélectionné");
		expect(describeSelection(["ALL_LOCATIONS", "SELECTED"], SCOPE_OPTIONS, undefined, FRENCH_LABELS)).toBe("2 sélectionnés : All stores, Selected stores only");
	});
});

describe("Select refs", () => {
	it("forwards refs on SelectValue, SelectClear and SelectEmpty", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const valueRef = React.createRef<HTMLSpanElement>();
		const clearRef = React.createRef<HTMLSpanElement>();
		const emptyRef = React.createRef<HTMLDivElement>();
		render(
			<Select items={SINGLE_OPTION} open>
				<SelectTrigger>
					<SelectValue ref={valueRef} placeholder="Pick" />
					<SelectClear ref={clearRef} onClear={noop} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">A</SelectItem>
					<SelectEmpty ref={emptyRef} />
				</SelectContent>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(valueRef.current?.dataset.slot).toBe("select-value");
		expect(clearRef.current?.dataset.slot).toBe("select-clear");
		expect(emptyRef.current?.dataset.slot).toBe("select-empty");
	});
});

interface ScopeSelectProps {
	readonly value: string | null;
	readonly defaultOpen?: boolean;
	readonly onValueChange?: (value: string | null) => void;
}

/** A controlled scope select — the shape every form field uses. */
function ScopeSelect({ value, defaultOpen = false, onValueChange = noop }: ScopeSelectProps): React.JSX.Element {
	return (
		<Select<string> items={SCOPE_OPTIONS} value={value} onValueChange={onValueChange} defaultOpen={defaultOpen} ariaLabel="Availability">
			<SelectTrigger>
				<SelectValue placeholder="Select availability" />
			</SelectTrigger>
			<SelectContent>
				{SCOPE_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** The trigger's value slot — scoped so an open popup's item text is never matched. */
function triggerValueText(): string | null | undefined {
	return screen.getByRole("combobox", { name: "Availability" }).querySelector("[data-slot='select-value']")?.textContent;
}

describe("Select value label", () => {
	it("shows the selected option's label in the closed trigger, never the raw value", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ScopeSelect value="ALL_LOCATIONS" />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("option")).toBeNull();
		expect(triggerValueText()).toBe("All stores");
	});

	it("shows the placeholder when nothing is selected", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ScopeSelect value={null} />, { wrapper: UiKitTestProviders });
		expect(triggerValueText()).toBe("Select availability");
	});

	it("keeps the trigger text identical to the selected item's text", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ScopeSelect value="SELECTED" defaultOpen />, { wrapper: UiKitTestProviders });
		expect(triggerValueText()).toBe(screen.getByRole("option", { name: "Selected stores only" }).textContent);
	});

	it("announces the chosen option's label in the live region", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onValueChange = vi.fn<(value: string | null) => void>();
		render(<ScopeSelect value="ALL_LOCATIONS" onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("combobox", { name: "Availability" }));
		});
		// A real mouse press: base-ui only commits a click that started on the item.
		const option = screen.getByRole("option", { name: "Selected stores only" });
		act((): void => {
			fireEvent.pointerDown(option, { pointerType: "mouse" });
			fireEvent.click(option);
		});
		expect(onValueChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toBe("SELECTED");
		expect(document.querySelector("[data-slot='select-live-region']")?.textContent).toBe(UI_KIT_LABELS_EN.select.selectedOne("Selected stores only"));
	});
});

describe("resolveSelectOptionLabel", () => {
	it("returns the matching option's label", (): void => {
		expect(resolveSelectOptionLabel("SELECTED", SCOPE_OPTIONS, undefined)).toBe("Selected stores only");
	});

	it("lets itemToStringLabel win over items, mirroring base-ui", (): void => {
		expect(resolveSelectOptionLabel("SELECTED", SCOPE_OPTIONS, (value: string): string => `custom ${value}`)).toBe("custom SELECTED");
	});

	it("falls back to the stringified value for a value outside the options", (): void => {
		expect(resolveSelectOptionLabel("UNKNOWN", SCOPE_OPTIONS, undefined)).toBe("UNKNOWN");
	});
});
