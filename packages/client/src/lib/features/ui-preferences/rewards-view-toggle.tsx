"use client";

import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { LayoutGrid, List } from "lucide-react";
import * as React from "react";

import { RewardsViewModeSchema, type RewardsViewMode } from "./state";

/** Copy for the grid/list switch — supplied by the app (rule 11). */
export interface RewardsViewToggleLabels {
	readonly group: string;
	readonly grid: string;
	readonly list: string;
}

export interface RewardsViewToggleProps {
	readonly viewMode: RewardsViewMode;
	readonly onViewModeChange: (mode: RewardsViewMode) => void;
	readonly labels: RewardsViewToggleLabels;
}

/**
 * The grid/list switch of a rewards catalog (web browse + landing, merchant
 * rewards). Controlled: the `ui-preferences` store owns the mode; this only
 * renders it and reports a validated choice.
 */
export function RewardsViewToggle({ viewMode, onViewModeChange, labels }: RewardsViewToggleProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(values: readonly string[]): void => {
			const parsed = RewardsViewModeSchema.safeParse(values[0]);
			if (parsed.success) {
				onViewModeChange(parsed.data);
			}
		},
		[onViewModeChange],
	);

	return (
		<ToggleGroup multiple={false} value={[viewMode]} onValueChange={handleValueChange} variant="outline" spacing={0} aria-label={labels.group}>
			<ToggleGroupItem value="grid" aria-label={labels.grid}>
				<LayoutGrid className="size-4" aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="list" aria-label={labels.list}>
				<List className="size-4" aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
