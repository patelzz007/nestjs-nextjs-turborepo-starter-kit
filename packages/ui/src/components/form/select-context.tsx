"use client";

import * as React from "react";
import { useContext } from "react";
import { z } from "zod";

/** The density of the select. */
export const selectSizeSchema = z.enum(["sm", "default", "lg"]);

export type SelectSize = z.infer<typeof selectSizeSchema>;

export interface SelectContextValue {
	readonly size: SelectSize;
	readonly loading: boolean;
	/** Accessible name for the trigger when there is no visible label (improvement 3). */
	readonly ariaLabel: string | undefined;
	/** Validation state — threads to the trigger as `aria-invalid` (RHF/zod rule 18). */
	readonly invalid: boolean;
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
 * Describes a selection for the sr-only live region. Takes a plain, narrowable
 * union (base-ui's conditional `SelectValueType` can't be narrowed via
 * `Array.isArray`). Uses `itemToStringLabel` when available so the announcement
 * matches what the trigger shows (the label, never the raw value).
 */
export function describeSelection<Value>(value: Value | Value[] | null, itemToStringLabel: ((itemValue: Value) => string) | undefined): string {
	if (Array.isArray(value)) {
		const labels = value.map((item) => itemToStringLabel?.(item) ?? String(item)).join(", ");
		return `${value.length.toString()} selected: ${labels}`;
	}
	if (value == null) {
		return "Nothing selected";
	}
	return `Selected ${itemToStringLabel?.(value) ?? String(value)}`;
}
