"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadRedo,
	SignaturePadUndo,
	type SignaturePadApi,
	type SignaturePadExportOptions,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleCheckIcon, DownloadIcon, ImageIcon, PenToolIcon, PlayIcon } from "lucide-react";
import * as React from "react";

import { focusOnMount } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

interface InkOption {
	readonly label: string;
	/**
	 * The design token the ink is drawn in, or `undefined` to follow the
	 * theme's text colour (legible in dark mode). A stroke records the token's
	 * resolved value, so exported images keep the colour.
	 */
	readonly token: string | undefined;
	readonly swatch: string;
}

const DEFAULT_INK: InkOption = { label: "Default", token: undefined, swatch: "bg-foreground" };
const INKS: readonly InkOption[] = [
	DEFAULT_INK,
	{ label: "Blue", token: "--tone-blue", swatch: "bg-tone-blue" },
	{ label: "Green", token: "--tone-green", swatch: "bg-tone-green" },
];

interface WeightOption {
	readonly label: string;
	/** The pad's `minWidth` / `maxWidth`, in CSS pixels. */
	readonly min: number;
	readonly max: number;
	/** Stroke width of the menu's sample squiggle. */
	readonly sample: number;
}

const DEFAULT_WEIGHT: WeightOption = { label: "Medium", min: 0.8, max: 3.2, sample: 1.75 };
const WEIGHTS: readonly WeightOption[] = [{ label: "Fine", min: 0.5, max: 1.8, sample: 1 }, DEFAULT_WEIGHT, { label: "Bold", min: 1.6, max: 5.5, sample: 2.75 }];

type DownloadFormat = "png" | "svg";

interface DownloadOption {
	readonly format: DownloadFormat;
	readonly label: string;
}

const DOWNLOADS: readonly DownloadOption[] = [
	{ format: "png", label: "PNG image" },
	{ format: "svg", label: "SVG vector" },
];

/**
 * Paper of the downloaded PNG. It colours a file, not the UI, so it is a
 * literal: paper-white reads the same on any page.
 */
const PNG_PAPER_COLOR = "#ffffff";
const PNG_EXPORT_OPTIONS: SignaturePadExportOptions = { background: PNG_PAPER_COLOR };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Replay draws at least this many points a frame… */
const MIN_REPLAY_POINTS_PER_FRAME = 2;
/** …and finishes in about this many frames. */
const REPLAY_FRAME_COUNT = 80;
/** No animation frame is pending. */
const NO_FRAME = 0;

const SIGNED_AT_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** The resolved value of a colour token on the document root (`undefined` for the theme ink). */
function resolveInkColor(option: InkOption): string | undefined {
	if (option.token === undefined) return undefined;
	const value = getComputedStyle(document.documentElement).getPropertyValue(option.token).trim();
	return value === "" ? undefined : value;
}

/** The first `count` points of `strokes`, in drawing order. */
function strokesUpTo(strokes: readonly SignaturePadStroke[], count: number): SignaturePadStroke[] {
	let left = count;
	const partial: SignaturePadStroke[] = [];
	for (const stroke of strokes) {
		if (left <= 0) break;
		partial.push(left >= stroke.points.length ? stroke : { ...stroke, points: stroke.points.slice(0, left) });
		left -= stroke.points.length;
	}
	return partial;
}

interface SwatchProps {
	readonly className: string;
}

function Swatch({ className }: SwatchProps): React.JSX.Element {
	return <span aria-hidden="true" className={cn("size-3.5 shrink-0 rounded-full ring-1 ring-foreground/15 ring-inset", className)} />;
}

interface StrokeProps {
	readonly width: number;
}

function Stroke({ width }: StrokeProps): React.JSX.Element {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={width} className="w-5 shrink-0">
			<path d="M2 8c3-5 6-5 9-1s7 4 11-3" />
		</svg>
	);
}

function download(href: string, name: string): void {
	const link = document.createElement("a");
	link.href = href;
	link.download = name;
	link.click();
}

interface DownloadMenuItemProps {
	readonly option: DownloadOption;
	readonly onDownload: (format: DownloadFormat) => void;
}

function DownloadMenuItem({ option, onDownload }: DownloadMenuItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onDownload(option.format);
	}, [onDownload, option.format]);

	return (
		<DropdownMenuItem onClick={handleClick}>
			{option.format === "png" ? <ImageIcon aria-hidden="true" /> : <PenToolIcon aria-hidden="true" />}
			{option.label}
		</DropdownMenuItem>
	);
}

export function SignaturePad4Example(): React.JSX.Element {
	const [ink, setInk] = React.useState<InkOption>(DEFAULT_INK);
	const [inkColor, setInkColor] = React.useState<string | undefined>(undefined);
	const [weight, setWeight] = React.useState<WeightOption>(DEFAULT_WEIGHT);
	const [strokes, setStrokes] = React.useState<SignaturePadStroke[]>([]);
	/* While set, the pad shows this partial copy instead of the real value. */
	const [replay, setReplay] = React.useState<SignaturePadStroke[] | null>(null);
	const [signedAt, setSignedAt] = React.useState<string | null>(null);
	const frame = React.useRef(NO_FRAME);
	const padRef = React.useRef<SignaturePadApi>(null);

	React.useEffect(
		(): (() => void) => (): void => {
			cancelAnimationFrame(frame.current);
		},
		[],
	);

	const playBack = React.useCallback((): void => {
		if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
		const total = strokes.reduce((sum: number, stroke: SignaturePadStroke): number => sum + stroke.points.length, 0);
		const perFrame = Math.max(MIN_REPLAY_POINTS_PER_FRAME, Math.ceil(total / REPLAY_FRAME_COUNT));
		let shown = 0;
		const step = (): void => {
			shown += perFrame;
			if (shown < total) {
				setReplay(strokesUpTo(strokes, shown));
				frame.current = requestAnimationFrame(step);
			} else {
				setReplay(null);
			}
		};
		frame.current = requestAnimationFrame(step);
	}, [strokes]);

	const locked = signedAt !== null || replay !== null;

	/* Through apiRef, so a menu item outside the pad's parts can export it. */
	const save = React.useCallback((format: DownloadFormat): void => {
		const value = padRef.current?.serialize(format, format === "png" ? PNG_EXPORT_OPTIONS : undefined);
		if (value) download(value, `signature.${format}`);
	}, []);

	const handleEdit = React.useCallback((): void => {
		setSignedAt(null);
		requestAnimationFrame((): void => {
			padRef.current?.focus();
		});
	}, []);

	const handleInkChange = React.useCallback((value: string): void => {
		const option = INKS.find((item: InkOption): boolean => item.label === value);
		if (!option) return;
		setInk(option);
		setInkColor(resolveInkColor(option));
	}, []);

	const handleWeightChange = React.useCallback((value: string): void => {
		const option = WEIGHTS.find((item: WeightOption): boolean => item.label === value);
		if (option) setWeight(option);
	}, []);

	const handleSign = React.useCallback((): void => {
		setSignedAt(SIGNED_AT_FORMAT.format(new Date()));
	}, []);

	return (
		<Card className="mx-auto w-full max-w-lg">
			<CardHeader>
				<CardTitle>Statement of work</CardTitle>
				<CardDescription>
					<span className="flex items-center gap-2">
						Harbor & Pine Design
						<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
						SOW-2041
					</span>
				</CardDescription>
				<CardAction>
					{/* Up here, away from Sign statement, so a double click on it
              cannot land on Edit and reopen what was just signed. */}
					<div className="flex items-center gap-2">
						{signedAt ? (
							<Button variant="ghost" size="xs" onClick={handleEdit}>
								Edit
							</Button>
						) : null}
						<Badge variant={signedAt ? "success-light" : "secondary"}>{signedAt ? "Signed" : "Draft"}</Badge>
					</div>
				</CardAction>
			</CardHeader>
			<CardContent>
				<SignaturePad
					apiRef={padRef}
					/* Replay swaps in a partial copy; readOnly keeps a stray stroke
             from landing in it and being committed as the real value. */
					value={replay ?? strokes}
					onValueChange={setStrokes}
					color={inkColor}
					minWidth={weight.min}
					maxWidth={weight.max}
					readOnly={locked}>
					<SignaturePadArea aria-label="Client signature" className="h-44">
						{/* Raised off the edge so the name below the line has room. */}
						<SignaturePadGuide className="bottom-11" />
						<SignaturePadPlaceholder />
						<p aria-hidden="true" className="pointer-events-none absolute start-6 bottom-4 text-xs text-muted-foreground">
							Daniel Reyes, Client
						</p>
					</SignaturePadArea>
					{/* One ghost row: each trigger shows its current choice and names
              it in the label, so the menus need no visible caption. */}
					<div className="flex items-center gap-1 pt-1">
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ink color, ${ink.label}`} disabled={locked} />}>
								<Swatch className={ink.swatch} />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Ink color</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={ink.label} onValueChange={handleInkChange}>
										{INKS.map((option: InkOption): React.JSX.Element => (
											/* Base UI keeps a radio menu open by default. */
											<DropdownMenuRadioItem key={option.label} value={option.label} closeOnClick>
												<Swatch className={option.swatch} />
												{option.label}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Line weight, ${weight.label}`} disabled={locked} />}>
								<Stroke width={weight.sample} />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Line weight</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={weight.label} onValueChange={handleWeightChange}>
										{WEIGHTS.map((option: WeightOption): React.JSX.Element => (
											<DropdownMenuRadioItem key={option.label} value={option.label} closeOnClick>
												<Stroke width={option.sample} />
												{option.label}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
						<Separator orientation="vertical" className="mx-1 my-auto h-4" />
						<SignaturePadUndo variant="ghost" />
						<SignaturePadRedo variant="ghost" />
						<Button variant="ghost" size="icon-sm" aria-label="Replay signature" disabled={strokes.length === 0 || locked} onClick={playBack}>
							<PlayIcon aria-hidden="true" />
						</Button>
						<SignaturePadClear variant="ghost" />
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="ghost" size="icon-sm" aria-label="Download signature" className="ms-auto" disabled={strokes.length === 0 || replay !== null} />}>
								<DownloadIcon aria-hidden="true" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Download as</DropdownMenuLabel>
									{DOWNLOADS.map((option: DownloadOption): React.JSX.Element => (
										<DownloadMenuItem key={option.format} option={option} onDownload={save} />
									))}
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</SignaturePad>
			</CardContent>
			<CardFooter>
				{signedAt ? (
					<p ref={focusOnMount} tabIndex={-1} role="status" className="ms-auto flex items-center gap-1.5 text-sm text-muted-foreground outline-none">
						<CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
						Signed {signedAt}
					</p>
				) : (
					<Button className="ms-auto" disabled={strokes.length === 0 || replay !== null} onClick={handleSign}>
						Sign statement
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
