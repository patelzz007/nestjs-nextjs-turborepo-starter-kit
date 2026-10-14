"use client";

import { isArrayValue } from "@workspace/shared";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import * as React from "react";
import { useContext } from "react";
import { z } from "zod";

/** The density of the select. */
export const selectSizeSchema = z.enum(["sm", "default", "lg"]);

export type SelectSize = z.infer<typeof selectSizeSchema>;

/**
 * Every user-facing string the Select parts render — the `select` family of
 * `UiKitLabels`, read from `UiKitLabelsProvider`. The Root's `labels` prop
 * overrides some of them for one usage, and a part-level prop (`ariaLabel`,
 * `text`, `loadingLabel`, …) still wins for a one-off override.
 */
export interface SelectLabels {
	/** Accessible name of the in-trigger clear affordance (`SelectClear`). */
	readonly clearSelection: string;
	/** Accessible name of the clear-all button (`SelectClearAll`). */
	readonly clearAll: string;
	/** Accessible name of the collapsed "+N" chip (`SelectChips`). */
	readonly moreSelected: string;
	/** Accessible name of a chip's remove affordance, given the chip's value (`SelectChip`). */
	readonly removeOption: (value: string) => string;
	/** The spinner row shown while options load (`SelectContent`). */
	readonly loading: string;
	/** The zero-option message (`SelectEmpty`). */
	readonly empty: string;
	/** Live-region announcement when the selection is cleared. */
	readonly nothingSelected: string;
	/** Live-region announcement for a single selection, given its label. */
	readonly selectedOne: (label: string) => string;
	/** Live-region announcement for a multi-selection, given the count and the joined labels. */
	readonly selectedMany: (count: number, labels: string) => string;
}

/** Separator between labels in the multi-selection announcement. */
const SELECTION_LABEL_SEPARATOR = ", ";

export interface SelectContextValue {
	readonly size: SelectSize;
	readonly loading: boolean;
	/** Accessible name for the trigger when there is no visible label (improvement 3). */
	readonly ariaLabel: string | undefined;
	/** Validation state — threads to the trigger as `aria-invalid` (RHF/zod rule 18). */
	readonly invalid: boolean;
	/** The Root's resolved copy (provider family + its `labels` override) for every part. */
	readonly labels: SelectLabels;
	/** Registers the rendered trigger so the Root's shortcut handler can focus it. */
	readonly registerTrigger: (node: HTMLButtonElement | null) => void;
}

export const SelectContext = React.createContext<SelectContextValue | null>(null);

export function useSelectContext(): SelectContextValue {
	const context = useContext(SelectContext);
	if (context === null) {
		throw new Error("Select parts must be rendered inside <Select>.");
	}
	return context;
}

/**
 * The Root's resolved copy, or the provider's `select` family outside a
 * `<Select>` — for parts that may be rendered beside the trigger (e.g.
 * `SelectClearAll`), so they never throw for a missing Root.
 */
export function useSelectLabels(): SelectLabels {
	const familyLabels = useUiKitLabels("select");
	return useContext(SelectContext)?.labels ?? familyLabels;
}

/**
 * One option of a Select: the stored `value` and the human `label` shown for
 * it. The Root's `items` is a list of these — base-ui only mounts the popup
 * (and so the `SelectItem` children) while it is open, so the closed trigger,
 * the live region and typeahead can only learn an option's label from `items`.
 * Without it they fall back to the raw value (e.g. "ALL_LOCATIONS").
 */
export interface SelectOption<Value> {
	readonly value: Value;
	readonly label: string;
}

/**
 * The label for one selected value, resolved in base-ui's own order (see
 * `resolveSelectedLabel` in `@base-ui/react`): `itemToStringLabel`, then the
 * matching `items` entry, then the stringified value as a last resort for a
 * value that is not among the options. Keeps the live region in lockstep with
 * what `SelectValue` renders in the trigger.
 */
export function resolveSelectOptionLabel<Value>(value: Value, items: readonly SelectOption<Value>[], itemToStringLabel: ((itemValue: Value) => string) | undefined): string {
	if (itemToStringLabel !== undefined) {
		return itemToStringLabel(value);
	}
	return items.find((item) => Object.is(item.value, value))?.label ?? String(value);
}

/**
 * Describes a selection for the sr-only live region. Takes a plain, narrowable
 * union (base-ui's conditional `SelectValueType` can't be narrowed via
 * `Array.isArray`). Resolves each value through `resolveSelectOptionLabel` so
 * the announcement matches what the trigger shows (the label, never the raw value).
 */
export function describeSelection<Value>(
	value: Value | Value[] | null,
	items: readonly SelectOption<Value>[],
	itemToStringLabel: ((itemValue: Value) => string) | undefined,
	labels: SelectLabels,
): string {
	if (isArrayValue(value)) {
		const joined = value.map((item) => resolveSelectOptionLabel(item, items, itemToStringLabel)).join(SELECTION_LABEL_SEPARATOR);
		return labels.selectedMany(value.length, joined);
	}
	if (value == null) {
		return labels.nothingSelected;
	}
	return labels.selectedOne(resolveSelectOptionLabel(value, items, itemToStringLabel));
}
