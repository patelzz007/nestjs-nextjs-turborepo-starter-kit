"use client";

import { Search, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DocsSearchBox — the docs search input. Dumb and controlled (rules 9–11): it
 * has no state of its own — the parent owns the query and passes it down via
 * `value`/`onChange`. It is used by the `/docs` index, which filters the guide
 * grid inline as you type (no page navigation involved).
 */

export interface DocsSearchBoxProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly className?: string;
	readonly placeholder?: string;
	readonly autoFocus?: boolean;
}

export function DocsSearchBox({ value, onChange, className, placeholder = "Search guides…", autoFocus = false }: DocsSearchBoxProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			if (event.key === "Escape" && value.length > 0) {
				onChange("");
			}
		},
		[onChange, value.length],
	);

	const handleClear = React.useCallback((): void => {
		onChange("");
	}, [onChange]);

	return (
		<div className={cn("relative", className)}>
			<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
			<input
				type="text"
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				autoFocus={autoFocus}
				placeholder={placeholder}
				aria-label="Search documentation"
				className="h-10 w-full rounded-lg border border-border bg-muted/30 pr-9 pl-9 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:outline-none"
			/>
			{value.length > 0 ? (
				<button
					type="button"
					onClick={handleClear}
					aria-label="Clear search"
					className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground">
					<X className="h-3.5 w-3.5" />
				</button>
			) : null}
		</div>
	);
}
