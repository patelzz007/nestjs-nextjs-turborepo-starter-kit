"use client";

import * as React from "react";
import { useState } from "react";
import { ColorPicker, type ColorPickerChannel, ColorPickerChannelInput, ColorPickerSlider, ColorPickerSwatch, ColorPickerValue } from "@workspace/ui/components/color-picker";

import { Card, CardContent } from "@workspace/ui/components/card";
import { InputGroup } from "@workspace/ui/components/input-group";

interface ChannelRow {
	readonly channel: ColorPickerChannel;
	readonly short: string;
}

const CHANNELS: readonly ChannelRow[] = [
	{ channel: "red", short: "R" },
	{ channel: "green", short: "G" },
	{ channel: "blue", short: "B" },
	{ channel: "alpha", short: "A" },
];

export function ColorPicker11Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>("rgb(244 63 94 / 0.85)");

	return (
		<Card className="w-full max-w-sm">
			<CardContent>
				<div className="flex flex-col gap-5">
					<ColorPicker value={value} onValueChange={setValue} alpha format="rgb" aria-label="Mixed color">
						<div className="flex items-center gap-3">
							<ColorPickerSwatch shape="circle" className="size-10" />
							<div className="flex min-w-0 flex-col">
								<span className="text-sm font-medium">Channel mixer</span>
								<span className="font-mono text-xs text-muted-foreground">
									<ColorPickerValue />
								</span>
							</div>
						</div>
						{/* Each track shows the range its channel can reach from here:
                dragging red redraws the green and blue tracks with it. */}
						<div className="grid gap-3">
							{CHANNELS.map(({ channel, short }: ChannelRow): React.JSX.Element => (
								<div key={channel} className="grid grid-cols-[1rem_1fr_4rem] items-center gap-3">
									<span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
										{short}
									</span>
									<ColorPickerSlider channel={channel} />
									<InputGroup>
										<ColorPickerChannelInput channel={channel} />
									</InputGroup>
								</div>
							))}
						</div>
					</ColorPicker>
				</div>
			</CardContent>
		</Card>
	);
}
