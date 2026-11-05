"use client";

// DataTable's pagination controls (enhancement 8.1: split from data-table.tsx).

import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import * as React from "react";
import { useCallback, useMemo } from "react";
import { formatDataTableLabel } from "@workspace/ui/lib/data-table/labels";

export interface PageNumberButtonProps {
	readonly pageNumber: number;
	readonly currentPage: number;
	readonly onPageSelect: (pageNumber: number) => void;
	readonly goToPageAriaLabel: string;
}

export const PageNumberButton = React.memo(function PageNumberButton({ pageNumber, currentPage, onPageSelect, goToPageAriaLabel }: PageNumberButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPageSelect(pageNumber);
	}, [onPageSelect, pageNumber]);

	return (
		<Button
			variant={currentPage === pageNumber ? "default" : "outline"}
			size="sm"
			onClick={handleClick}
			className="h-8 w-8 p-0"
			aria-label={formatDataTableLabel(goToPageAriaLabel, { page: pageNumber })}
			aria-current={currentPage === pageNumber ? "page" : undefined}>
			{pageNumber}
		</Button>
	);
});

// ── Page Size Select (sub-component) ───────────────────────────────────────

export interface PageSizeSelectProps {
	/** Ids of the visible words around the select ("Show" … "per page"), which name it for screen readers. */
	readonly ariaLabelledBy: string;
	readonly pageSize: number;
	readonly options: readonly number[];
	readonly onPageSizeChange: (size: number) => void;
}

export const PageSizeSelect = React.memo(function PageSizeSelect({ ariaLabelledBy, pageSize, options, onPageSizeChange }: PageSizeSelectProps): React.JSX.Element {
	const handleValueChange = useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onPageSizeChange(Number(value));
			}
		},
		[onPageSizeChange],
	);

	const sizeOptions = useMemo((): readonly SelectOption<string>[] => options.map((size): SelectOption<string> => ({ value: String(size), label: String(size) })), [options]);

	return (
		<Select<string> value={String(pageSize)} onValueChange={handleValueChange} items={sizeOptions}>
			<SelectTrigger className="w-20" aria-labelledby={ariaLabelledBy}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{sizeOptions.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});

// ── Header Cell (sub-component: sort + pin affordances live here) ───────────
