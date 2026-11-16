"use client";

import * as React from "react";
import {
	ColorPicker,
	ColorPickerArea,
	ColorPickerContent,
	ColorPickerFields,
	ColorPickerPanel,
	ColorPickerSlider,
	ColorPickerSwatch,
	ColorPickerTrigger,
	formatColor,
	useColorPicker,
} from "@workspace/ui/components/color-picker";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

const PROPERTIES = [
	{ id: "inspector-fill", label: "Fill", value: "#6366f1" },
	{ id: "inspector-stroke", label: "Stroke", value: "#0f172a" },
	{ id: "inspector-shadow", label: "Shadow", value: "#0f172a40" },
];

/* Hex and opacity apart, the way design tools print a color. */
function InspectorValue(): React.JSX.Element | null {
	const { color } = useColorPicker();
	if (!color) return null;
	return (
		<>
			<ColorPickerSwatch />
			<span className="font-mono text-xs">
				{formatColor({ ...color, alpha: 1 }, "hex")
					.slice(1)
					.toUpperCase()}
			</span>
			<span className="ms-auto text-xs text-muted-foreground tabular-nums">{Math.round(color.alpha * 100)}%</span>
		</>
	);
}

export function ColorPicker12Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader>
				<CardTitle>Rectangle</CardTitle>
				<CardDescription>Hero card, 320 by 180</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-2.5">
					{PROPERTIES.map(({ id, label, value }) => (
						<div key={id} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
							<span id={id} className="text-sm text-muted-foreground">
								{label}
							</span>
							<ColorPicker defaultValue={value} alpha aria-labelledby={id}>
								<ColorPickerTrigger size="sm" className="w-full">
									<InspectorValue />
								</ColorPickerTrigger>
								{/* Vertical hue and opacity tracks beside the area, the
                    compact layout of a design tool's inspector. */}
								<ColorPickerContent align="end">
									<ColorPickerPanel>
										<div className="flex gap-3">
											<ColorPickerArea className="h-44 w-auto min-w-0 flex-1" />
											<ColorPickerSlider channel="hue" orientation="vertical" className="h-44" />
											<ColorPickerSlider channel="alpha" orientation="vertical" className="h-44" />
										</div>
										<ColorPickerFields />
									</ColorPickerPanel>
								</ColorPickerContent>
							</ColorPicker>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
