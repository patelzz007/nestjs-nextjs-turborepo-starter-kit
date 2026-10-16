"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { ColorPicker, ColorPickerContent, ColorPickerSwatch, ColorPickerSwatches, ColorPickerTrigger, getForegroundColor } from "@workspace/ui/components/color-picker";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

const LABEL_COLORS = [
	{ value: "#ef4444", label: "Red" },
	{ value: "#f97316", label: "Orange" },
	{ value: "#eab308", label: "Yellow" },
	{ value: "#22c55e", label: "Green" },
	{ value: "#14b8a6", label: "Teal" },
	{ value: "#3b82f6", label: "Blue" },
	{ value: "#8b5cf6", label: "Violet" },
	{ value: "#ec4899", label: "Pink" },
	{ value: "#64748b", label: "Slate" },
];

/** The label badge filled with the picked colour, its text in whichever ink reads on it. */
function badgeStyleFor(color: string | null): React.CSSProperties {
	const ink = color ? getForegroundColor(color) : null;
	return { backgroundColor: color ?? undefined, color: ink ?? undefined };
}

export function ColorPicker5Example(): React.JSX.Element {
	const [name, setName] = useState("Needs design");
	const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);
	const [color, setColor] = useState<string | null>("#8b5cf6");
	const custom = !!color && !LABEL_COLORS.some((preset) => preset.value === color);
	const badgeStyle = useMemo((): React.CSSProperties => badgeStyleFor(color), [color]);

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Edit label</CardTitle>
				<CardDescription>Labels group issues across projects.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="label-name">Name</FieldLabel>
						<Input id="label-name" value={name} onChange={handleNameChange} />
					</Field>
					<Field>
						<FieldLabel id="label-color-label">Color</FieldLabel>
						<ColorPicker value={color} onValueChange={setColor}>
							<div className="flex items-center gap-3">
								<ColorPickerSwatches colors={LABEL_COLORS} shape="circle" aria-labelledby="label-color-label" className="flex-1" />
								{/* The plus opens the full picker; once a custom color is
                    set, it shows that color instead. */}
								<ColorPickerTrigger size="icon-sm" aria-label="Custom color">
									{custom ? <ColorPickerSwatch shape="circle" /> : <PlusIcon aria-hidden="true" />}
								</ColorPickerTrigger>
								<ColorPickerContent align="end" />
							</div>
						</ColorPicker>
					</Field>
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">Preview</span>
						<Badge style={badgeStyle}>{name.trim() || "Untitled"}</Badge>
					</div>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
