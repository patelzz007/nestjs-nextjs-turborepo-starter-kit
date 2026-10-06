"use client";

import { Input } from "@workspace/ui/components/input";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { Search } from "lucide-react";
import * as React from "react";

export interface DataTableSearchToolbarProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** Defaults to the kit pack's `dataTable.searchPlaceholder`. */
	readonly placeholder?: string;
	/** Defaults to the kit pack's `dataTable.searchAriaLabel`. */
	readonly ariaLabel?: string;
	readonly className?: string;
}

/** Shared server-side search input for admin DataTables. */
export function DataTableSearchToolbar({
	value,
	onChange,
	placeholder,
	ariaLabel,
	className = "relative w-full sm:max-w-xs",
}: DataTableSearchToolbarProps): React.JSX.Element {
	const tableLabels = useUiKitLabels("dataTable");
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<div className={className}>
			<Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				aria-label={ariaLabel ?? tableLabels.searchAriaLabel}
				placeholder={placeholder ?? tableLabels.searchPlaceholder}
				value={value}
				onChange={handleChange}
				className="h-9 pl-8 text-sm"
			/>
		</div>
	);
}
