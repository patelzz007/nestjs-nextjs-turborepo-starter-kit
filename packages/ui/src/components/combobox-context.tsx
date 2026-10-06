"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import * as React from "react";
import { useContext } from "react";
import { z } from "zod";

/** The density of the combobox. */
export const comboboxSizeSchema = z.enum(["sm", "default", "lg"]);

/** Validates the label of a chip — used to derive a default remove aria-label. */
export const comboboxChipLabelSchema = z.string();

/** Validates a combobox value in form flows (rule 4: string keys are the norm). */
export const comboboxChipValueSchema = z.string();

export type ComboboxSize = z.infer<typeof comboboxSizeSchema>;

/**
 * The list's max height, hoisted into a CSS custom property (improvement 11).
 * The calc is evaluated once by the browser instead of per list element, and
 * consumers can override `--combobox-list-max-h` at their own scope.
 */
/** CSS custom properties are kebab-case by spec, so the key is declared via `Record` rather than a property signature. */
export type ComboboxListMaxHeightStyle = React.CSSProperties & Readonly<Record<"--combobox-list-max-h", string>>;

export const comboboxListMaxHeightStyle: ComboboxListMaxHeightStyle = {
	"--combobox-list-max-h": "min(calc(var(--spacing-72) - var(--spacing-9)), calc(var(--available-height) - var(--spacing-9)))",
};

/**
 * Every user-facing string the Combobox parts render — the `combobox` family
 * of `UiKitLabels`, read from `UiKitLabelsProvider`. The Root's `labels` prop
 * overrides some of them for one usage, and a part-level prop (`ariaLabel`,
 * `text`, `loadingLabel`, …) still wins for a one-off override.
 */
export interface ComboboxLabels {
	/** Accessible name of the chevron toggle (`ComboboxTrigger`). */
	readonly openOptions: string;
	/** Accessible name of the clear (x) button (`ComboboxClear`). */
	readonly clearSelection: string;
	/** Accessible name of the selection-reset button (`ComboboxClearAll`). */
	readonly clearAll: string;
	/** The spinner row shown while options load (`ComboboxList`). */
	readonly loading: string;
	/** The zero-result message (`ComboboxEmpty`). */
	readonly empty: string;
	/** Accessible name of the collapsed "+N" chip (`ComboboxChips`). */
	readonly moreSelected: string;
	/** Accessible name of a chip's remove button, given the chip's text (`ComboboxChip`). */
	readonly removeOption: (label: string) => string;
	/** Accessible name of a chip's remove button when the chip has no plain-text label. */
	readonly removeOptionFallback: string;
	/** Live-region announcement of the selection count. */
	readonly selectedCount: (count: number) => string;
}

export interface ComboboxContextValue {
	readonly size: ComboboxSize;
	readonly loading: boolean;
	readonly invalid: boolean;
	/** Cap on visible chips — set on the Root, consumed by `ComboboxChips` (feature 9). */
	readonly maxChips: number | undefined;
	/** The Root's resolved copy (provider family + its `labels` override) for every part. */
	readonly labels: ComboboxLabels;
	/** Registers the rendered input so the Root's shortcut handler can focus it. */
	readonly registerInput: (node: HTMLInputElement | null) => void;
}

export const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);

export function useComboboxContext(): ComboboxContextValue {
	const context = useContext(ComboboxContext);
	if (context === null) {
		throw new Error("Combobox parts must be rendered inside <Combobox>.");
	}
	return context;
}

/**
 * The Root's resolved copy, or the provider's `combobox` family outside a
 * `<Combobox>` — for parts that may be rendered standalone (e.g.
 * `ComboboxClearAll`), so they never throw for a missing Root.
 */
export function useComboboxLabels(): ComboboxLabels {
	const familyLabels = useUiKitLabels("combobox");
	return useContext(ComboboxContext)?.labels ?? familyLabels;
}

/** Reads a chip's plain-text child for the default remove label (rule 13). */
export function extractStringChild(children: React.ReactNode): string | undefined {
	const parsed = comboboxChipLabelSchema.safeParse(children);
	return parsed.success ? parsed.data : undefined;
}

export function useComboboxAnchor(): React.RefObject<HTMLDivElement | null> {
	return React.useRef<HTMLDivElement | null>(null);
}
