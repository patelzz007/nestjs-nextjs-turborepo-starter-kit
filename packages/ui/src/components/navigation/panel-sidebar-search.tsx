"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { cn } from "@workspace/ui/lib/utils";
import { Search, X } from "lucide-react";
import * as React from "react";

export interface PanelSidebarSearchProps {
	readonly value: string;
	readonly placeholder: string;
	readonly ariaLabel: string;
	readonly clearAriaLabel: string;
	readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onClear: () => void;
	readonly inputRef?: React.Ref<HTMLInputElement>;
	readonly className?: string;
}

/** Inset sidebar search with `/` keyboard hint when empty. */
export function PanelSidebarSearch({ value, placeholder, ariaLabel, clearAriaLabel, onChange, onClear, inputRef, className }: PanelSidebarSearchProps): React.JSX.Element {
	const [localValue, setLocalValue] = React.useState(value);
	const prevValueRef = React.useRef(value);

	React.useEffect((): void => {
		if (value !== prevValueRef.current && value !== localValue) {
			setLocalValue(value);
		}
		prevValueRef.current = value;
	}, [value, localValue]);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setLocalValue(event.target.value);
			onChange(event);
		},
		[onChange],
	);

	const hasQuery = localValue.length > 0;

	return (
		<div className={cn("p-3", className)}>
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
				<Input
					ref={inputRef}
					type="text"
					role="searchbox"
					placeholder={placeholder}
					value={localValue}
					onChange={handleChange}
					aria-label={ariaLabel}
					className={cn(
						"h-9 w-full rounded-lg border-0 bg-sidebar-accent/60 pl-9 text-sm shadow-none ring-1 ring-sidebar-foreground/10 ring-inset",
						"placeholder:text-muted-foreground/60",
						"focus-visible:bg-sidebar-accent focus-visible:ring-sidebar-ring/45",
						hasQuery ? "pr-9" : "pr-10",
					)}
				/>
				{hasQuery ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onClear}
						className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
						aria-label={clearAriaLabel}>
						<X className="size-3.5" />
					</Button>
				) : (
					<kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-sidebar-border bg-sidebar/90 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70 sm:inline">
						/
					</kbd>
				)}
			</div>
		</div>
	);
}
