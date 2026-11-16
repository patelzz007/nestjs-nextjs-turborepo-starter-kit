"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { ColorPicker } from "@workspace/ui/components/color-picker";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function ColorPicker4Example(): React.JSX.Element {
	const [overlay, setOverlay] = useState<string | null>("rgb(15 23 42 / 0.55)");
	const overlayStyle = useMemo((): React.CSSProperties => ({ background: overlay ?? "transparent" }), [overlay]);

	return (
		<Card className="w-full max-w-sm overflow-hidden pt-0">
			<div className="relative flex h-40 items-end bg-linear-135 from-tone-orange via-tone-red via-45% to-tone-violet p-5">
				<div aria-hidden="true" className="absolute inset-0" style={overlayStyle} />
				<div className="relative">
					<p className="text-xs font-medium tracking-wide text-status-foreground/80 uppercase">New season</p>
					<p className="text-lg font-semibold text-status-foreground">Spring collection</p>
				</div>
			</div>
			<CardContent>
				<Field>
					<FieldLabel id="banner-overlay-label" htmlFor="banner-overlay">
						Banner overlay
					</FieldLabel>
					{/* `alpha` adds the opacity slider and field; `format="rgb"` writes
              the value as rgb(15 23 42 / 0.55), ready for a style prop. */}
					<ColorPicker
						id="banner-overlay"
						value={overlay}
						onValueChange={setOverlay}
						alpha
						format="rgb"
						aria-labelledby="banner-overlay-label"
						aria-describedby="banner-overlay-description"
					/>
					<FieldDescription id="banner-overlay-description">Darken the artwork so the headline stays readable.</FieldDescription>
				</Field>
			</CardContent>
		</Card>
	);
}
