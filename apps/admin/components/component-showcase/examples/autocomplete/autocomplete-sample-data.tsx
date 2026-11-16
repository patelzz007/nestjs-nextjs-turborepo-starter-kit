"use client";

// Sample data and render helpers shared by the Autocomplete examples: a list
// of issue tags (labels plus kit component names), the two ways an example
// renders a suggestion, and the accent- and case-insensitive match the
// filtering examples use. Sample data only — nothing here calls an API.

import { AutocompleteItem } from "@workspace/ui/components/autocomplete";
import type * as React from "react";

/** One suggestion: a stable id (the React key) and the text the input receives. */
export interface SampleTag {
	readonly id: string;
	readonly value: string;
}

export const SAMPLE_TAGS: readonly SampleTag[] = [
	{ id: "t1", value: "Feature" },
	{ id: "t2", value: "Fix" },
	{ id: "t3", value: "Bug" },
	{ id: "t4", value: "Docs" },
	{ id: "t5", value: "Internal" },
	{ id: "t6", value: "Mobile" },
	{ id: "c-accordion", value: "component: Accordion" },
	{ id: "c-alert-dialog", value: "component: Alert Dialog" },
	{ id: "c-autocomplete", value: "component: Autocomplete" },
	{ id: "c-avatar", value: "component: Avatar" },
	{ id: "c-checkbox", value: "component: Checkbox" },
	{ id: "c-checkbox-group", value: "component: Checkbox Group" },
	{ id: "c-collapsible", value: "component: Collapsible" },
	{ id: "c-combobox", value: "component: Combobox" },
	{ id: "c-context-menu", value: "component: Context Menu" },
	{ id: "c-dialog", value: "component: Dialog" },
	{ id: "c-field", value: "component: Field" },
	{ id: "c-fieldset", value: "component: Fieldset" },
	{ id: "c-filterable-menu", value: "component: Filterable Menu" },
	{ id: "c-form", value: "component: Form" },
	{ id: "c-input", value: "component: Input" },
	{ id: "c-menu", value: "component: Menu" },
	{ id: "c-menubar", value: "component: Menubar" },
	{ id: "c-meter", value: "component: Meter" },
	{ id: "c-navigation-menu", value: "component: Navigation Menu" },
	{ id: "c-number-field", value: "component: Number Field" },
	{ id: "c-popover", value: "component: Popover" },
	{ id: "c-preview-card", value: "component: Preview Card" },
	{ id: "c-progress", value: "component: Progress" },
	{ id: "c-radio", value: "component: Radio" },
	{ id: "c-scroll-area", value: "component: Scroll Area" },
	{ id: "c-select", value: "component: Select" },
	{ id: "c-separator", value: "component: Separator" },
	{ id: "c-slider", value: "component: Slider" },
	{ id: "c-switch", value: "component: Switch" },
	{ id: "c-tabs", value: "component: Tabs" },
	{ id: "c-toast", value: "component: Toast" },
	{ id: "c-toggle", value: "component: Toggle" },
	{ id: "c-toggle-group", value: "component: Toggle Group" },
	{ id: "c-toolbar", value: "component: Toolbar" },
	{ id: "c-tooltip", value: "component: Tooltip" },
];

/** The text a tag puts in the input (the Autocomplete's `itemToStringValue`). */
export function sampleTagText(tag: SampleTag): string {
	return tag.value;
}

/** A suggestion row whose value is the tag's text — for lists the Autocomplete filters itself. */
export function renderSampleTagText(tag: SampleTag): React.JSX.Element {
	return (
		<AutocompleteItem key={tag.id} value={tag.value}>
			{tag.value}
		</AutocompleteItem>
	);
}

/** A suggestion row whose value is the tag object — paired with `itemToStringValue={sampleTagText}`. */
export function renderSampleTag(tag: SampleTag): React.JSX.Element {
	return (
		<AutocompleteItem key={tag.id} value={tag}>
			{tag.value}
		</AutocompleteItem>
	);
}

/** Combining marks left behind once accented letters are decomposed (NFD). */
const COMBINING_MARKS = /\p{Diacritic}/gu;

function foldForMatch(text: string): string {
	return text.normalize("NFD").replace(COMBINING_MARKS, "").toLocaleLowerCase();
}

/** Whether `text` contains `query`, ignoring case and accents ("jose" finds "José"). */
export function containsQuery(text: string, query: string): boolean {
	return foldForMatch(text).includes(foldForMatch(query));
}

/** The tags whose text contains `query`. */
export function filterSampleTags(query: string): readonly SampleTag[] {
	return SAMPLE_TAGS.filter((tag: SampleTag): boolean => containsQuery(tag.value, query));
}

/** "Jane Smith" → "JS": the first letter of each word, for avatar fallbacks. */
export function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((word: string): string => word.charAt(0))
		.join("");
}
