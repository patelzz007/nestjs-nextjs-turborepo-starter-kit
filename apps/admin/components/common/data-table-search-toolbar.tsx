"use client";

import { Input } from "@workspace/ui/components/form/input";
import { Search } from "lucide-react";
import * as React from "react";

export interface DataTableSearchToolbarProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly className?: string;
}

/** Shared server-side search input for admin DataTables. */
export function DataTableSearchToolbar({
	value,
	onChange,
	placeholder = "Search...",
	ariaLabel = "Search rows",
	className = "relative w-full sm:max-w-xs",
}: DataTableSearchToolbarProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<div className={className}>
			<Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={handleChange} className="h-9 pl-8 text-sm" />
		</div>
	);
}
