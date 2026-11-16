"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import {
	ColorPicker,
	ColorPickerArea,
	ColorPickerContent,
	ColorPickerEyeDropper,
	ColorPickerFields,
	ColorPickerPanel,
	ColorPickerSlider,
	ColorPickerSwatches,
	ColorPickerTrigger,
} from "@workspace/ui/components/color-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

/** Sample brush colours already used, newest first; the list keeps this many. */
const INITIAL_RECENT: readonly string[] = ["#0f172a", "#e11d48", "#f59e0b", "#10b981"];
const MAX_RECENT = 8;

export function ColorPicker9Example(): React.JSX.Element {
	const [color, setColor] = useState<string | null>("#2563eb");
	const [recent, setRecent] = useState<readonly string[]>(INITIAL_RECENT);

	const handleCommit = useCallback((next: string | null): void => {
		if (next === null || next === "") {
			return;
		}
		setRecent((list: readonly string[]): readonly string[] => [next, ...list.filter((item: string): boolean => item !== next)].slice(0, MAX_RECENT));
	}, []);

	return (
		<div className="w-full max-w-xs">
			<Field>
				<FieldLabel id="brush-color-label" htmlFor="brush-color">
					Brush color
				</FieldLabel>
				{/* `onValueCommit` fires once per pick, when a drag is released, so
            dragging across the area adds one recent color, not hundreds. */}
				<ColorPicker
					id="brush-color"
					value={color}
					onValueChange={setColor}
					onValueCommit={handleCommit}
					aria-labelledby="brush-color-label"
					aria-describedby="brush-color-description">
					<ColorPickerTrigger />
					<ColorPickerContent>
						<ColorPickerPanel>
							<ColorPickerArea />
							<div className="flex items-center gap-3">
								<ColorPickerEyeDropper />
								<ColorPickerSlider channel="hue" />
							</div>
							<ColorPickerFields />
							<div className="flex flex-col gap-2">
								<span id="brush-recent-label" className="text-xs font-medium text-muted-foreground">
									Recent
								</span>
								<ColorPickerSwatches colors={recent} aria-labelledby="brush-recent-label" />
							</div>
						</ColorPickerPanel>
					</ColorPickerContent>
				</ColorPicker>
				<FieldDescription id="brush-color-description">Colors you pick are kept under Recent.</FieldDescription>
			</Field>
		</div>
	);
}
