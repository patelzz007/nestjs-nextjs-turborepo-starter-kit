"use client";

import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { useCallback } from "react";

export function BackupExcludeTableCheckbox({
	table,
	isExcluded,
	disabled,
	onToggle,
}: {
	readonly table: { readonly name: string; readonly excludedByDefault: boolean };
	readonly isExcluded: boolean;
	readonly disabled: boolean;
	readonly onToggle: (name: string, checked: boolean) => void;
}): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(checked: boolean): void => {
			onToggle(table.name, checked);
		},
		[onToggle, table.name],
	);
	return (
		<label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
			<Checkbox checked={isExcluded} disabled={disabled} onCheckedChange={handleCheckedChange} />
			<span className="min-w-0 truncate font-mono text-xs">{table.name}</span>
			{table.excludedByDefault && !isExcluded ? <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">default</span> : null}
		</label>
	);
}
