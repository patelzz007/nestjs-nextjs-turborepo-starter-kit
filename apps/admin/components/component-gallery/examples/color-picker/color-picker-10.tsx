"use client";

import * as React from "react";
import { BoldIcon, HighlighterIcon, TypeIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ColorPicker, ColorPickerClear, ColorPickerContent, ColorPickerSwatches, ColorPickerTrigger } from "@workspace/ui/components/color-picker";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Separator } from "@workspace/ui/components/separator";
import { Toggle } from "@workspace/ui/components/toggle";

const TEXT_COLORS = [
	{ value: "#6b7280", label: "Gray" },
	{ value: "#dc2626", label: "Red" },
	{ value: "#ea580c", label: "Orange" },
	{ value: "#ca8a04", label: "Yellow" },
	{ value: "#16a34a", label: "Green" },
	{ value: "#0d9488", label: "Teal" },
	{ value: "#2563eb", label: "Blue" },
	{ value: "#7c3aed", label: "Violet" },
	{ value: "#db2777", label: "Pink" },
	{ value: "#92400e", label: "Brown" },
];

const HIGHLIGHTS = [
	{ value: "#fef08a", label: "Yellow" },
	{ value: "#bbf7d0", label: "Green" },
	{ value: "#bfdbfe", label: "Blue" },
	{ value: "#fbcfe8", label: "Pink" },
	{ value: "#fed7aa", label: "Orange" },
	{ value: "#ddd6fe", label: "Violet" },
	{ value: "#99f6e4", label: "Teal" },
	{ value: "#fecaca", label: "Red" },
	{ value: "#d9f99d", label: "Lime" },
	{ value: "#e5e7eb", label: "Gray" },
];

const SWATCH_GRID = "grid-cols-[repeat(5,var(--color-picker-swatch-size))]";

/* A palette menu: presets, then a way back to no color at all. */
interface ColorMenuProps {
	readonly title: string;
	readonly colors: typeof TEXT_COLORS;
	readonly reset: string;
}

function ColorMenu({ title, colors, reset }: ColorMenuProps): React.JSX.Element {
	return (
		<ColorPickerContent className="w-auto">
			<span className="text-xs font-medium text-muted-foreground">{title}</span>
			<ColorPickerSwatches colors={colors} aria-label={title} className={SWATCH_GRID} />
			<Separator />
			<ColorPickerClear className="justify-start">{reset}</ColorPickerClear>
		</ColorPickerContent>
	);
}

export function ColorPicker10Example(): React.JSX.Element {
	const [bold, setBold] = useState(false);
	/* `null` is the editor's default ink and no highlight at all. */
	const [ink, setInk] = useState<string | null>(null);
	const [highlight, setHighlight] = useState<string | null>("#fef08a");
	/* Each palette closes on a pick, like an editor menu, and hands focus back
     to its toolbar button. */
	const [menu, setMenu] = useState<"ink" | "highlight" | null>(null);

	const closeMenu = useCallback((): void => {
		setMenu(null);
	}, []);
	const handleInkOpenChange = useCallback((open: boolean): void => {
		setMenu(open ? "ink" : null);
	}, []);
	const handleHighlightOpenChange = useCallback((open: boolean): void => {
		setMenu(open ? "highlight" : null);
	}, []);

	const inkBarStyle = useMemo((): React.CSSProperties => ({ background: ink ?? "currentColor" }), [ink]);
	const highlightBarStyle = useMemo((): React.CSSProperties => ({ background: highlight ?? "transparent" }), [highlight]);
	const textStyle = useMemo((): React.CSSProperties => ({ color: ink ?? undefined }), [ink]);
	const markStyle = useMemo((): React.CSSProperties => ({ backgroundColor: highlight ?? "transparent" }), [highlight]);

	return (
		/* Two panels: the toolbar, then the text it formats. */
		<Frame spacing="sm" className="w-full max-w-md">
			<FramePanel>
				<div className="flex items-center gap-1">
					<Toggle size="sm" aria-label="Bold" pressed={bold} onPressedChange={setBold}>
						<BoldIcon aria-hidden="true" />
					</Toggle>
					<Separator orientation="vertical" className="my-auto h-4" />
					<ColorPicker value={ink} onValueChange={setInk} onValueCommit={closeMenu} open={menu === "ink"} onOpenChange={handleInkOpenChange} aria-label="Text color">
						{/* The bar under the glyph shows the current ink. */}
						<ColorPickerTrigger variant="ghost" size="icon-sm">
							<span className="relative flex">
								<TypeIcon aria-hidden="true" />
								<span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full" style={inkBarStyle} />
							</span>
						</ColorPickerTrigger>
						<ColorMenu title="Text color" colors={TEXT_COLORS} reset="Default color" />
					</ColorPicker>
					<ColorPicker
						value={highlight}
						onValueChange={setHighlight}
						onValueCommit={closeMenu}
						open={menu === "highlight"}
						onOpenChange={handleHighlightOpenChange}
						aria-label="Highlight color">
						<ColorPickerTrigger variant="ghost" size="icon-sm">
							<span className="relative flex">
								<HighlighterIcon aria-hidden="true" />
								<span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full" style={highlightBarStyle} />
							</span>
						</ColorPickerTrigger>
						<ColorMenu title="Highlight" colors={HIGHLIGHTS} reset="No highlight" />
					</ColorPicker>
				</div>
			</FramePanel>
			<FramePanel>
				<p className="text-sm leading-relaxed data-bold:font-semibold" data-bold={bold || undefined} style={textStyle}>
					The launch review moves to Thursday.{" "}
					<mark className="rounded-sm px-0.5 text-inherit" style={markStyle}>
						Bring the final pricing and the onboarding copy
					</mark>{" "}
					so we can sign off before the press embargo lifts.
				</p>
			</FramePanel>
		</Frame>
	);
}
