"use client";

import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import {
	ColorPicker,
	type ColorPickerChannel,
	ColorPickerChannelInput,
	ColorPickerCopy,
	ColorPickerSlider,
	getForegroundColor,
	isColorInSrgb,
	parseColor,
} from "@workspace/ui/components/color-picker";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";

interface ChannelRow {
	readonly channel: ColorPickerChannel;
	readonly short: string;
}

const CHANNELS: readonly ChannelRow[] = [
	{ channel: "lightness", short: "L" },
	{ channel: "chroma", short: "C" },
	{ channel: "hue", short: "H" },
];

export function ColorPicker6Example(): React.JSX.Element {
	/* Tailwind's blue-500, a P3 color: its chroma runs past sRGB. */
	const [primary, setPrimary] = useState<string | null>("oklch(62.3% 0.214 259.815)");
	const color = parseColor(primary);
	const foreground = color ? getForegroundColor(color) : null;
	/* The preview re-points the theme tokens themselves, so the Button and the
     Badge below render exactly as they would with this --primary. */
	const previewRef = useRef<HTMLDivElement>(null);

	useLayoutEffect((): void => {
		const preview = previewRef.current;
		if (preview === null) {
			return;
		}
		if (primary !== null && foreground !== null) {
			preview.style.setProperty("--primary", primary);
			preview.style.setProperty("--primary-foreground", foreground);
		} else {
			preview.style.removeProperty("--primary");
			preview.style.removeProperty("--primary-foreground");
		}
	}, [primary, foreground]);

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Primary color</CardTitle>
				<CardDescription>Tune the --primary token in OKLCH, the format shadcn and Tailwind v4 themes use.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-5">
					<ColorPicker value={primary} onValueChange={setPrimary} format="oklch" aria-label="Primary color">
						<div className="grid gap-3">
							{CHANNELS.map(({ channel, short }: ChannelRow): React.JSX.Element => (
								<div key={channel} className="grid grid-cols-[1rem_1fr_4.5rem] items-center gap-3">
									<span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
										{short}
									</span>
									<ColorPickerSlider channel={channel} colorSpace="oklch" />
									<InputGroup>
										<ColorPickerChannelInput channel={channel} colorSpace="oklch" />
									</InputGroup>
								</div>
							))}
						</div>
						<InputGroup>
							<InputGroupInput readOnly value={`--primary: ${primary ?? "none"};`} aria-label="CSS variable" />
							<InputGroupAddon align="inline-end">
								<ColorPickerCopy size="icon-xs" />
							</InputGroupAddon>
						</InputGroup>
					</ColorPicker>
					<div className="flex flex-wrap items-center gap-3" ref={previewRef}>
						{/* Each fills with --primary and draws on --primary-foreground,
                so all three follow the picked color. */}
						<Button>Save changes</Button>
						<Badge>New</Badge>
						<div className="flex items-center gap-2">
							<Checkbox id="primary-notify" defaultChecked />
							<Label htmlFor="primary-notify">Notify team</Label>
						</div>
						{color && !isColorInSrgb(color) ? (
							<Badge variant="warning-light" className="ms-auto">
								Outside sRGB
							</Badge>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
