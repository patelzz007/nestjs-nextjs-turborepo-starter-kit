"use client";

import * as React from "react";
import { useState } from "react";
import { ColorPicker, ColorPickerArea, ColorPickerFields, ColorPickerWheel } from "@workspace/ui/components/color-picker";

import { Card, CardContent } from "@workspace/ui/components/card";

export function ColorPicker8Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>("#f43f5e");

	return (
		<Card className="w-fit">
			<CardContent>
				<div className="flex flex-col items-center gap-5">
					<ColorPicker value={value} onValueChange={setValue} aria-label="Brush">
						{/* The area fills the square inside the ring: hue on the ring,
                saturation and brightness in the middle. */}
						<ColorPickerWheel className="size-56">
							<ColorPickerArea className="size-full" />
						</ColorPickerWheel>
						<ColorPickerFields formats={["hex", "rgb", "hsl"]} className="w-56" />
					</ColorPicker>
				</div>
			</CardContent>
		</Card>
	);
}
