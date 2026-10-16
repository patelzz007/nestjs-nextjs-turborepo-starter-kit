"use client";

import * as React from "react";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useCallback, useMemo, useState } from "react";
import { ColorPicker, ColorPickerContent, ColorPickerInput, ColorPickerSwatch, formatColor, parseColor } from "@workspace/ui/components/color-picker";
import type { ColorPickerColor } from "@workspace/ui/components/color-picker";

import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";

/** One shade of the scale: its name, and Tailwind's blue-scale OKLCH lightness and chroma (relative to 500) at that step. */
interface ScaleStep {
	readonly step: number;
	readonly lightness: number;
	readonly chroma: number;
}

/* Tailwind's blue scale in OKLCH: lightness per step, and chroma relative to
   500. The base color becomes 500 and the curve bends around its lightness. */
const SCALE_STEPS: readonly ScaleStep[] = [
	{ step: 50, lightness: 97, chroma: 0.07 },
	{ step: 100, lightness: 93.2, chroma: 0.15 },
	{ step: 200, lightness: 88.2, chroma: 0.28 },
	{ step: 300, lightness: 80.9, chroma: 0.47 },
	{ step: 400, lightness: 70.7, chroma: 0.77 },
	{ step: 500, lightness: 62.3, chroma: 1 },
	{ step: 600, lightness: 54.6, chroma: 1.14 },
	{ step: 700, lightness: 48.8, chroma: 1.14 },
	{ step: 800, lightness: 42.4, chroma: 0.93 },
	{ step: 900, lightness: 37.9, chroma: 0.68 },
	{ step: 950, lightness: 28.2, chroma: 0.43 },
];

/** The reference lightness of step 500, which the base colour is mapped onto. */
const BASE_LIGHTNESS = 62.3;
const BASE_STEP = 500;
const FULL_LIGHTNESS = 100;
const COPIED_FEEDBACK_MS = 2000;

interface ScaleSwatch {
	readonly step: number;
	readonly value: string;
}

function buildScale(base: ColorPickerColor): readonly ScaleSwatch[] {
	const oklch = parseColor(formatColor(base, "oklch"));
	if (!oklch) {
		return [];
	}
	const [lightness, chroma, hue] = oklch.channels;
	return SCALE_STEPS.map(({ step, lightness: target, chroma: relativeChroma }: ScaleStep): ScaleSwatch => {
		// Lighter steps stretch towards white, darker ones scale towards black, both pivoting on the base.
		const l =
			step < BASE_STEP
				? FULL_LIGHTNESS - ((FULL_LIGHTNESS - target) * (FULL_LIGHTNESS - lightness)) / (FULL_LIGHTNESS - BASE_LIGHTNESS)
				: (target * lightness) / BASE_LIGHTNESS;
		const color: ColorPickerColor = { space: "oklch", channels: [l, chroma * relativeChroma, hue], alpha: 1 };
		return { step, value: formatColor(color, "hex") };
	});
}

function scaleFor(base: string | null): readonly ScaleSwatch[] {
	const parsed = parseColor(base);
	return parsed ? buildScale(parsed) : [];
}

/** The scale as CSS custom property declarations, one per line. */
function cssVariablesFor(scale: readonly ScaleSwatch[]): string {
	return scale.map(({ step, value }: ScaleSwatch): string => `--brand-${String(step)}: ${value};`).join("\n");
}

export function ColorPicker14Example(): React.JSX.Element {
	const [base, setBase] = useState<string | null>("#7c3aed");
	const { isCopied: copied, copyToClipboard } = useCopyToClipboard({ timeout: COPIED_FEEDBACK_MS });
	const scale = useMemo((): readonly ScaleSwatch[] => scaleFor(base), [base]);
	const css = useMemo((): string => cssVariablesFor(scale), [scale]);

	const handleCopy = useCallback((): void => {
		copyToClipboard(css);
	}, [copyToClipboard, css]);

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Brand scale</CardTitle>
				<CardDescription>11 shades from one base color.</CardDescription>
				<CardAction>
					<Button variant="outline" size="sm" disabled={!css} onClick={handleCopy}>
						{copied ? "Copied" : "Copy CSS"}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-5">
					<Field>
						<FieldLabel htmlFor="brand-base">Base color</FieldLabel>
						<ColorPicker id="brand-base" value={base} onValueChange={setBase}>
							<ColorPickerInput />
							<ColorPickerContent />
						</ColorPicker>
					</Field>
					<ol className="grid grid-cols-11 gap-1">
						{scale.map(({ step, value }: ScaleSwatch): React.JSX.Element => (
							<li key={step} className="flex flex-col items-center gap-1.5">
								<ColorPickerSwatch color={value} aria-label={`${String(step)}, ${value}`} className="h-10 w-full" />
								<span className="text-[0.625rem] text-muted-foreground tabular-nums">{step}</span>
							</li>
						))}
					</ol>
					<span role="status" className="sr-only">
						{copied ? "CSS variables copied" : ""}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
