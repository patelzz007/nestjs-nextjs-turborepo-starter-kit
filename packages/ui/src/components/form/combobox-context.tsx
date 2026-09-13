"use client";

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
/** CSS custom properties are kebab-case by spec; bypass the camelCase naming rule for this one. */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type ComboboxListMaxHeightStyle = React.CSSProperties & { readonly "--combobox-list-max-h": string };

export const comboboxListMaxHeightStyle: ComboboxListMaxHeightStyle = {
	"--combobox-list-max-h": "min(calc(var(--spacing-72) - var(--spacing-9)), calc(var(--available-height) - var(--spacing-9)))",
};

export interface ComboboxContextValue {
	readonly size: ComboboxSize;
	readonly loading: boolean;
	readonly invalid: boolean;
	/** Cap on visible chips — set on the Root, consumed by `ComboboxChips` (feature 9). */
	readonly maxChips: number | undefined;
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

/** Reads a chip's plain-text child for the default remove label (rule 13). */
export function extractStringChild(children: React.ReactNode): string | undefined {
	const parsed = comboboxChipLabelSchema.safeParse(children);
	return parsed.success ? parsed.data : undefined;
}

export function useComboboxAnchor(): React.RefObject<HTMLDivElement | null> {
	return React.useRef<HTMLDivElement | null>(null);
}
