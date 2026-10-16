"use client";

import * as React from "react";
import { useState } from "react";
import { ColorPicker, ColorPickerArea, ColorPickerCopy, ColorPickerSlider, formatColor, useColorPicker } from "@workspace/ui/components/color-picker";
import type { ColorPickerFormat } from "@workspace/ui/components/color-picker";

import { Card, CardContent } from "@workspace/ui/components/card";

const FORMATS: { format: ColorPickerFormat; label: string }[] = [
	{ format: "hex", label: "HEX" },
	{ format: "rgb", label: "RGB" },
	{ format: "hsl", label: "HSL" },
	{ format: "hsb", label: "HSB" },
	{ format: "oklch", label: "OKLCH" },
];

/* Reads the picker through its hook, so it needs no value of its own. */
function FormatList(): React.JSX.Element {
	const { color } = useColorPicker();
	return (
		<ul className="divide-y">
			{FORMATS.map(({ format, label }) => (
				<li key={format} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
					<span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
					<code className="min-w-0 flex-1 truncate font-mono text-sm">{color ? formatColor(color, format) : "None"}</code>
					<ColorPickerCopy format={format} size="icon-xs" aria-label={`Copy ${label}`} />
				</li>
			))}
		</ul>
	);
}

export function ColorPicker7Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>("#14b8a6");

	return (
		<Card className="w-full">
			<CardContent>
				<ColorPicker value={value} onValueChange={setValue} alpha aria-label="Color to convert">
					{/* Side by side once the card itself has room for the longest value
              (a container query, not the viewport); minmax(0, 1fr) columns
              truncate a value rather than push the copy buttons out. */}
					<div className="@container">
						<div className="grid grid-cols-1 gap-6 @xl:grid-cols-[13rem_minmax(0,1fr)] @xl:items-center">
							<div className="flex flex-col gap-3">
								<ColorPickerArea className="h-36" />
								<ColorPickerSlider channel="hue" />
								<ColorPickerSlider channel="alpha" />
							</div>
							<FormatList />
						</div>
					</div>
				</ColorPicker>
			</CardContent>
		</Card>
	);
}
