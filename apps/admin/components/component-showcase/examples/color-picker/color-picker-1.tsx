"use client";

import * as React from "react";
import { useState } from "react";
import { ColorPicker, ColorPickerPanel } from "@workspace/ui/components/color-picker";

import { Card, CardContent } from "@workspace/ui/components/card";

const SWATCHES = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

export function ColorPicker1Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>("#6366f1");

	return (
		<Card className="w-full max-w-96">
			<CardContent>
				{/* `alpha` adds the opacity slider and field; `swatches` adds the
            presets row under the default panel. */}
				<ColorPicker value={value} onValueChange={setValue} alpha swatches={SWATCHES} aria-label="Fill color">
					<ColorPickerPanel />
				</ColorPicker>
			</CardContent>
		</Card>
	);
}
