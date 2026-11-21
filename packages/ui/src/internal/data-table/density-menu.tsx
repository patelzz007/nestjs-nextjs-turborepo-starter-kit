"use client";

// DataTable's density control: a toolbar menu with the three row sizes. It holds no state: the table tells it the
// current density and hears the reader's choice.

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { DataTableDensitySchema, type DataTableDensity, type DataTableLabels } from "@workspace/ui-kit-logic";
import { Rows3 } from "lucide-react";
import * as React from "react";

import { TOOLBAR_MENU_TRIGGER_CLASS_NAME } from "./shared";

export interface DensityMenuProps {
	readonly density: DataTableDensity;
	readonly onDensityChange: (density: DataTableDensity) => void;
	readonly labels: DataTableLabels;
}

/** The label of each density, from the table's copy. */
function densityLabel(density: DataTableDensity, labels: DataTableLabels): string {
	if (density === "compact") {
		return labels.densityCompact;
	}
	return density === "spacious" ? labels.densitySpacious : labels.densityComfortable;
}

export const DensityMenu = React.memo(function DensityMenu({ density, onDensityChange, labels }: DensityMenuProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(value: string): void => {
			const next = DataTableDensitySchema.safeParse(value);
			if (next.success) {
				onDensityChange(next.data);
			}
		},
		[onDensityChange],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" className={TOOLBAR_MENU_TRIGGER_CLASS_NAME}>
						<Rows3 className="size-4" aria-hidden="true" />
						<span>{labels.densityToggle}</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{labels.densityToggle}</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={density} onValueChange={handleValueChange}>
						{DataTableDensitySchema.options.map((option) => (
							<DropdownMenuRadioItem key={option} value={option}>
								{densityLabel(option, labels)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
