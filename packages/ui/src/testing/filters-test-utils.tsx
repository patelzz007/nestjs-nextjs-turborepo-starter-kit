"use client";

// Test-only helpers for the filters family: jsdom stubs base-ui needs,
// a field schema fixture, and a CONTROLLED harness (the bar holds no query).

import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { vi } from "vitest";

import { Filters, type FiltersProps } from "@workspace/ui/components/filters/filters";
import { createFilterQuery } from "@workspace/ui/components/filters/filters-query";
import type { FilterChangeDetails, FilterField, FilterQuery } from "@workspace/ui/components/filters/filters-types";

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

function scrollIntoViewStub(): void {
	return;
}

/** base-ui measures popups (ResizeObserver) and scrolls the highlighted row into view. Undo with `vi.unstubAllGlobals()`. */
export function stubFiltersDom(): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: scrollIntoViewStub });
}

export const STATUS_FIELD: FilterField = {
	id: "status",
	label: "Status",
	type: "select",
	options: [
		{ value: "open", label: "Open" },
		{ value: "closed", label: "Closed" },
		{ value: "none", label: "No status", exclusive: true },
	],
};

export const FILTER_FIXTURE_FIELDS: readonly FilterField[] = [
	STATUS_FIELD,
	{ id: "name", label: "Name", type: "text" },
	{ id: "age", label: "Age", type: "number" },
	{ id: "active", label: "Active", type: "boolean" },
	{ id: "owner", label: "Owner", fields: [{ id: "email", label: "Email", type: "text" }] },
];

export interface FiltersHarnessProps extends Omit<FiltersProps, "query" | "onQueryChange" | "fields"> {
	readonly fields?: readonly FilterField[] | undefined;
	readonly initialQuery?: FilterQuery | undefined;
	readonly onChange?: ((query: FilterQuery, details: FilterChangeDetails) => void) | undefined;
	readonly filtersRef?: React.Ref<HTMLDivElement> | undefined;
}

const EMPTY_QUERY = createFilterQuery();

/** A parent that owns the query, as every real consumer does. */
export function FiltersHarness({ fields = FILTER_FIXTURE_FIELDS, initialQuery = EMPTY_QUERY, onChange, filtersRef, ...props }: FiltersHarnessProps): React.JSX.Element {
	const [query, setQuery] = React.useState(initialQuery);
	const handleChange = React.useCallback(
		(next: FilterQuery, details: FilterChangeDetails): void => {
			setQuery(next);
			onChange?.(next, details);
		},
		[onChange],
	);
	return (
		<UiKitTestProviders>
			<Filters ref={filtersRef} fields={fields} query={query} onQueryChange={handleChange} {...props} />
		</UiKitTestProviders>
	);
}
