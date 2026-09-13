"use client";

import { RewardHubViewModeSchema, type RewardHubViewMode } from "@/lib/rewards/view-mode";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/form/toggle-group";
import { LayoutGrid, List } from "lucide-react";
import * as React from "react";

export interface RewardHubViewToggleProps {
	readonly viewMode: RewardHubViewMode;
	readonly onViewModeChange: (mode: RewardHubViewMode) => void;
}

export function RewardHubViewToggle({ viewMode, onViewModeChange }: RewardHubViewToggleProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(values: readonly string[]): void => {
			const next = values[0];
			if (next === undefined) {
				return;
			}
			const parsed = RewardHubViewModeSchema.safeParse(next);
			if (parsed.success) {
				onViewModeChange(parsed.data);
			}
		},
		[onViewModeChange],
	);

	return (
		<ToggleGroup multiple={false} value={[viewMode]} onValueChange={handleValueChange} variant="outline" spacing={0} aria-label="Rewards layout">
			<ToggleGroupItem value="grid" aria-label="Grid view">
				<LayoutGrid className="size-4" aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="list" aria-label="List view">
				<List className="size-4" aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
