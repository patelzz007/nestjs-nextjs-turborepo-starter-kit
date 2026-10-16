"use client";

import * as React from "react";
import { ArrowLeftRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { ColorPicker, getContrastRatio } from "@workspace/ui/components/color-picker";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";

/* WCAG 2.2 thresholds: 4.5 and 7 for body text, 3 for large text. */
interface ContrastCheck {
	readonly level: string;
	readonly text: string;
	readonly min: number;
}

const CHECKS: readonly ContrastCheck[] = [
	{ level: "AA", text: "Body", min: 4.5 },
	{ level: "AAA", text: "Body", min: 7 },
	{ level: "AA", text: "Large", min: 3 },
];

const RATIO_DECIMALS = 2;

interface ContrastCheckRowProps {
	readonly check: ContrastCheck;
	readonly ratio: number | null;
}

function ContrastCheckRow({ check, ratio }: ContrastCheckRowProps): React.JSX.Element {
	const pass = ratio !== null && ratio >= check.min;
	return (
		<li className="flex items-center gap-2 text-xs">
			<span className="text-muted-foreground">
				{check.text} {check.level}
			</span>
			<Badge variant={pass ? "success-light" : "destructive-light"}>{pass ? "Pass" : "Fail"}</Badge>
		</li>
	);
}

function previewStyleFor(text: string | null, background: string | null): React.CSSProperties {
	return { backgroundColor: background ?? undefined, color: text ?? undefined };
}

export function ColorPicker13Example(): React.JSX.Element {
	const [text, setText] = useState<string | null>("#1e3a8a");
	const [background, setBackground] = useState<string | null>("#dbeafe");

	/* The sample panel paints the picked pair directly. */
	const previewStyle = useMemo((): React.CSSProperties => previewStyleFor(text, background), [text, background]);
	const handleSwap = useCallback((): void => {
		setText(background);
		setBackground(text);
	}, [background, text]);

	const ratio = text && background ? getContrastRatio(text, background) : null;

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Contrast checker</CardTitle>
				<CardDescription>WCAG ratios for a text and background pair.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-5">
					<Frame>
						<FramePanel style={previewStyle}>
							<div className="flex flex-col gap-1">
								<p className="text-lg font-semibold">Quarterly report is ready</p>
								<p className="text-sm">Revenue grew 18% on the quarter, led by self-serve plans.</p>
							</div>
						</FramePanel>
					</Frame>
					<div className="flex items-end gap-2">
						<Field className="min-w-0 flex-1">
							<FieldLabel id="contrast-text-label" htmlFor="contrast-text">
								Text
							</FieldLabel>
							<ColorPicker id="contrast-text" value={text} onValueChange={setText} aria-labelledby="contrast-text-label" />
						</Field>
						<Button variant="outline" size="icon" aria-label="Swap text and background" onClick={handleSwap}>
							<ArrowLeftRightIcon aria-hidden="true" />
						</Button>
						<Field className="min-w-0 flex-1">
							<FieldLabel id="contrast-background-label" htmlFor="contrast-background">
								Background
							</FieldLabel>
							<ColorPicker id="contrast-background" value={background} onValueChange={setBackground} aria-labelledby="contrast-background-label" />
						</Field>
					</div>
					<div className="flex items-center justify-between gap-4">
						<div role="status">
							<p className="text-3xl font-semibold tabular-nums">{ratio === null ? "None" : `${ratio.toFixed(RATIO_DECIMALS)}:1`}</p>
							<p className="text-xs text-muted-foreground">Contrast ratio</p>
						</div>
						<ul className="flex flex-col items-end gap-1.5">
							{CHECKS.map((check: ContrastCheck): React.JSX.Element => (
								<ContrastCheckRow key={`${check.level}-${check.text}`} check={check} ratio={ratio} />
							))}
						</ul>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
