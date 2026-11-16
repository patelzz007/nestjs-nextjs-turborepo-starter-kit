// A file-type icon (the web kit's `FileType`, ported from ReUI): a page in
// the type's tone with its extension label (PDF, XLSX) or its family's glyph.
// The type table and the rules that read a type from an extension, a family,
// a file name or a MIME type are shared with the web (@workspace/shared
// `resolveFileType`, `getFileType`), so both draw the same icon for a file.
//
// `variant`: `outline` (the default), `light` (a muted page), `solid` (the
// page filled with the tone) or `mono` (every type in the muted grey). `size`
// `mini` (18 pt) to `xl` (56 pt). `label` replaces the extension (a version
// tag); `null` or "" hides it; `glyph` shows the family glyph instead; `icon`
// draws a glyph of the caller's on the page; `tone` recolours a type.
//
// react-native-svg takes colour values, not classes, so the tone is read from
// the theme. It is one image for screen readers, named after the type ("PDF
// file", "Spreadsheet", "V3, DOCX file"); `labels` give that name in another
// language. The ref reaches the root view.

import { resolveFileType, type FileTypeCategory, type FileTypeLabels, type FileTypeTone } from "@workspace/ui-kit-logic";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type TextStyle, type ViewInstance, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

import { cn } from "../lib/cn";

const ColorSchema = z.string();

export const fileTypeVariants = cva("relative shrink-0", {
	variants: {
		size: { mini: "size-4.5", xs: "size-6", sm: "size-8", md: "size-10", lg: "size-12", xl: "size-14" },
	},
	defaultVariants: { size: "md" },
});

/** The label band: the tone's colour behind the label (a solid page has none: its label sits on the fill). */
export const fileTypeLabelVariants = cva("absolute items-center justify-center overflow-hidden rounded-sm", {
	variants: {
		tone: {
			neutral: "bg-muted-foreground",
			blue: "bg-tone-blue",
			green: "bg-tone-green",
			yellow: "bg-tone-yellow",
			red: "bg-tone-red",
			orange: "bg-tone-orange",
			teal: "bg-tone-teal",
			violet: "bg-tone-violet",
		},
		solid: { true: "bg-transparent", false: "" },
	},
	defaultVariants: { tone: "neutral", solid: false },
});

/** The label's text: the colour drawn on the tone. */
export const fileTypeLabelTextVariants = cva("font-sans-semibold", {
	variants: {
		tone: {
			neutral: "text-background",
			blue: "text-tone-blue-soft",
			green: "text-tone-green-soft",
			yellow: "text-tone-yellow-soft",
			red: "text-tone-red-soft",
			orange: "text-tone-orange-soft",
			teal: "text-tone-teal-soft",
			violet: "text-tone-violet-soft",
		},
	},
	defaultVariants: { tone: "neutral" },
});

export type FileTypeVariant = "outline" | "solid" | "light" | "mono";
export type FileTypeSize = NonNullable<VariantProps<typeof fileTypeVariants>["size"]>;

/** The box's side per size, in points: the stroke and the label are measured against it. */
export const FILE_TYPE_POINTS: Readonly<Record<FileTypeSize, number>> = { mini: 18, xs: 24, sm: 32, md: 40, lg: 48, xl: 56 };

/** The web's English names; a screen in another language passes its own. */
export const DEFAULT_FILE_TYPE_LABELS: FileTypeLabels = {
	categories: {
		archive: "Archive",
		audio: "Audio file",
		code: "Code file",
		design: "Design file",
		document: "Document",
		empty: "File",
		executable: "Application",
		file: "File",
		folder: "Folder",
		font: "Font file",
		image: "Image",
		presentation: "Presentation",
		spreadsheet: "Spreadsheet",
		video: "Video",
	},
	typeFile: (type: string): string => `${type} file`,
	labelledType: (label: string, typeName: string): string => `${label}, ${typeName}`,
};

/** The theme tokens a tone paints with: the type colour, and the colour of text drawn on it. */
const TONE_TOKENS: Readonly<Record<FileTypeTone, { readonly color: string; readonly on: string }>> = {
	neutral: { color: "--color-muted-foreground", on: "--color-background" },
	blue: { color: "--color-tone-blue", on: "--color-tone-blue-soft" },
	green: { color: "--color-tone-green", on: "--color-tone-green-soft" },
	yellow: { color: "--color-tone-yellow", on: "--color-tone-yellow-soft" },
	red: { color: "--color-tone-red", on: "--color-tone-red-soft" },
	orange: { color: "--color-tone-orange", on: "--color-tone-orange-soft" },
	teal: { color: "--color-tone-teal", on: "--color-tone-teal-soft" },
	violet: { color: "--color-tone-violet", on: "--color-tone-violet-soft" },
};

/** One shape of a family glyph, in the 24-unit page grid. */
type GlyphShape =
	| { readonly kind: "path"; readonly d: string }
	| { readonly kind: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly rx: number }
	| { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number };

/** The web's glyphs, drawn under the fold in the box x 7–17, y 10–20. */
const GLYPHS: Partial<Readonly<Record<FileTypeCategory, readonly GlyphShape[]>>> = {
	document: [{ kind: "path", d: "M8 12h8M8 15h5.5M8 18h7" }],
	spreadsheet: [
		{ kind: "rect", x: 7.5, y: 11, width: 9, height: 8, rx: 1 },
		{ kind: "path", d: "M7.5 14.5h9M11 11v8" },
	],
	presentation: [
		{ kind: "rect", x: 7, y: 11, width: 10, height: 5.5, rx: 1 },
		{ kind: "path", d: "m9.5 19.5 2.5-3 2.5 3" },
	],
	image: [
		{ kind: "path", d: "m7 19.5 3.5-5.5 2.75 3.75 1.25-1.75 2.5 3.5Z" },
		{ kind: "circle", cx: 14.25, cy: 12, r: 1.25 },
	],
	video: [{ kind: "path", d: "M9.5 11v8l7-4Z" }],
	audio: [
		{ kind: "path", d: "M12.5 18v-7l3 1.5" },
		{ kind: "circle", cx: 10.75, cy: 18, r: 1.75 },
	],
	code: [{ kind: "path", d: "m10 12-3 3 3 3m4-6 3 3-3 3" }],
	archive: [
		{ kind: "rect", x: 7, y: 11, width: 10, height: 3, rx: 0.75 },
		{ kind: "path", d: "M8 14v4.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V14M11 16.5h2" },
	],
	design: [
		{ kind: "circle", cx: 10.5, cy: 13, r: 2.5 },
		{ kind: "rect", x: 12, y: 14.5, width: 5, height: 5, rx: 1 },
	],
	executable: [
		{ kind: "rect", x: 7.5, y: 10.75, width: 3.5, height: 3.5, rx: 0.75 },
		{ kind: "rect", x: 13, y: 10.75, width: 3.5, height: 3.5, rx: 0.75 },
		{ kind: "rect", x: 7.5, y: 16.25, width: 3.5, height: 3.5, rx: 0.75 },
		{ kind: "rect", x: 13, y: 16.25, width: 3.5, height: 3.5, rx: 0.75 },
	],
	font: [{ kind: "path", d: "M8.5 12.5V11h7v1.5M12 11v8m-1.5 0h3" }],
	folder: [{ kind: "path", d: "M7 12a1 1 0 0 1 1-1h2.25a1 1 0 0 1 .8.4l.9 1.1H16a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" }],
};

/** The page: 16 by 20 units with 2-unit corners and a rounded fold; the fold line; the folded corner. */
const PAGE_PATH = "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7.586a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V20a2 2 0 0 1-2 2Z";
const FOLD_PATH = "M14 2v5a1 1 0 0 0 1 1h5";
const FLAP_PATH = "M13.586 2a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V8h-5a1 1 0 0 1-1-1V2Z";

const VIEWBOX_UNITS = 24;
/** Up to this size (pt) every detail counts: the glyph is drawn full size and the outline darker. */
const SMALL_BOX = 21;
/** The stroke: 1 pt, then 2.5% of the box. */
const MIN_STROKE = 1;
const STROKE_SHARE = 0.025;
/** The glyph is drawn at 75% around its centre, under the fold. */
const GLYPH_SCALE = "translate(12 15) scale(0.75) translate(-12 -15)";
/** The outline's strength: 40% of the muted grey, 65% on a small box. */
const OUTLINE_OPACITY = 0.4;
const SMALL_OUTLINE_OPACITY = 0.65;
/** The solid page's fold and flap, in the colour drawn on it. */
const SOLID_FOLD_OPACITY = 0.45;
const SOLID_FLAP_OPACITY = 0.3;
/** The label band: where it sits and how tall it is, as a share of the box (a small box's is taller). */
const LABEL_TOP = 0.45;
const SMALL_LABEL_TOP = 0.4;
const LABEL_HEIGHT = 0.35;
const SMALL_LABEL_HEIGHT = 0.45;
/** The band's left edge and widest width, and its side padding (a solid page has no band: its label spans the middle two thirds). */
const LABEL_LEFT = 0.05;
const LABEL_MAX_WIDTH = 0.95;
const LABEL_PADDING = 0.07;
const SOLID_LABEL_LEFT = 1 / 6;
const SOLID_LABEL_WIDTH = 2 / 3;
/** The label's text: up to 24% of the box, smaller for a long label so it fits the band. */
const LABEL_FONT_SHARE = 0.24;
const LABEL_WIDTH_SHARE = 0.81;
const CHARACTER_WIDTH = 0.72;
/** The character count a label of any length is fitted as, at least: every label up to 4 reads the same size. */
const MIN_LABEL_CHARS = 4;

/** The label's font size for a box of `points` and a label of `characters`. */
export function fileTypeLabelFontSize(points: number, characters: number): number {
	return Math.min(points * LABEL_FONT_SHARE, (points * LABEL_WIDTH_SHARE) / (Math.max(characters, MIN_LABEL_CHARS) * CHARACTER_WIDTH));
}

export interface FileTypeProps {
	/** An extension ("pdf", ".docx"), a family ("image", "folder") or "empty"; use `getFileType` for a file name or MIME type. */
	readonly type?: string | undefined;
	readonly variant?: FileTypeVariant | undefined;
	readonly size?: FileTypeSize | undefined;
	/** Replaces the extension label (a version tag); `null` or "" hides it. */
	readonly label?: string | null | undefined;
	/** Shows the family glyph instead of the label. */
	readonly glyph?: boolean | undefined;
	/** A glyph of the caller's, drawn on the page in place of the label and the family glyph. Decorative. */
	readonly icon?: React.ReactNode;
	/** Recolours the type with another tone. */
	readonly tone?: FileTypeTone | undefined;
	/** Extra classes for the label band, merged last (a pill, an inverted band). */
	readonly labelClassName?: string | undefined;
	/** Extra classes for the label's text, merged last. */
	readonly labelTextClassName?: string | undefined;
	/** The spoken name's words; English by default. */
	readonly labels?: FileTypeLabels | undefined;
	/** Extra classes for the root, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** What screen readers hear: the type's name, with a custom label in front of it. */
export function fileTypeNameOf(type: string | undefined, label: string | null | undefined, labels: FileTypeLabels): string {
	const resolved = resolveFileType(type);
	// The name spells out a key its label shortens (DOCKERFILE, not DOCK).
	const spelled = resolved.label === undefined ? undefined : resolved.type.toUpperCase();
	const typeName = spelled === undefined ? labels.categories[resolved.category] : labels.typeFile(spelled);
	const custom = (label ?? "").toUpperCase();
	return custom !== "" && custom !== resolved.label && custom !== spelled ? labels.labelledType(label ?? "", typeName) : typeName;
}

function GlyphShapes({ shapes }: { readonly shapes: readonly GlyphShape[] }): React.JSX.Element {
	return (
		<>
			{shapes.map((shape: GlyphShape, index: number): React.JSX.Element => {
				const key = `${shape.kind}-${String(index)}`;
				if (shape.kind === "path") {
					return <Path key={key} d={shape.d} />;
				}
				if (shape.kind === "rect") {
					return <Rect key={key} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
				}
				return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} />;
			})}
		</>
	);
}

export const FileType = React.memo(
	React.forwardRef<ViewInstance, FileTypeProps>(function FileType(
		{ type, variant = "outline", size = "md", label, glyph = false, icon, tone, labelClassName, labelTextClassName, labels = DEFAULT_FILE_TYPE_LABELS, className, testID },
		ref,
	): React.JSX.Element {
		const resolved = resolveFileType(type);
		const paint = variant === "mono" ? "neutral" : (tone ?? resolved.tone);
		const color = ColorSchema.safeParse(useCSSVariable(TONE_TOKENS[paint].color)).data;
		const on = ColorSchema.safeParse(useCSSVariable(TONE_TOKENS[paint].on)).data;
		const muted = ColorSchema.safeParse(useCSSVariable("--color-muted-foreground")).data;
		const mutedFill = ColorSchema.safeParse(useCSSVariable("--color-muted")).data;
		const points = FILE_TYPE_POINTS[size];
		const small = points <= SMALL_BOX;
		// `null` hides the label like "", where `??` would fall back to it.
		const text = label === undefined ? resolved.label : label;
		const hasText = text !== undefined && text !== null && text !== "";
		const hasIcon = icon !== undefined && icon !== null;
		const showLabel = hasText && !glyph && !hasIcon;
		const shapes = showLabel || hasIcon ? undefined : GLYPHS[resolved.category];
		const strokeWidth = (Math.max(MIN_STROKE, points * STROKE_SHARE) * VIEWBOX_UNITS) / points;
		const solid = variant === "solid";
		const bandStyle = React.useMemo(
			(): ViewStyle => ({
				top: points * (small ? SMALL_LABEL_TOP : LABEL_TOP),
				height: points * (small ? SMALL_LABEL_HEIGHT : LABEL_HEIGHT),
				left: points * (solid ? SOLID_LABEL_LEFT : LABEL_LEFT),
				...(solid ? { width: points * SOLID_LABEL_WIDTH } : { maxWidth: points * LABEL_MAX_WIDTH, paddingHorizontal: points * LABEL_PADDING }),
			}),
			[points, small, solid],
		);
		const labelStyle = React.useMemo((): TextStyle => ({ fontSize: fileTypeLabelFontSize(points, hasText ? text.length : MIN_LABEL_CHARS) }), [hasText, points, text]);
		const drawn = color !== undefined && on !== undefined && muted !== undefined && mutedFill !== undefined;
		return (
			<View
				ref={ref}
				accessible
				accessibilityRole="image"
				accessibilityLabel={fileTypeNameOf(type, label, labels)}
				testID={testID}
				className={cn(fileTypeVariants({ size }), className)}>
				{drawn ? (
					<Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
						<Path
							d={PAGE_PATH}
							fill={solid ? color : variant === "light" ? mutedFill : "none"}
							stroke={solid ? color : muted}
							strokeOpacity={solid ? 1 : small ? SMALL_OUTLINE_OPACITY : OUTLINE_OPACITY}
							strokeWidth={strokeWidth}
						/>
						{solid ? <Path d={FLAP_PATH} fill={on} fillOpacity={SOLID_FLAP_OPACITY} /> : null}
						<Path
							d={FOLD_PATH}
							stroke={solid ? on : muted}
							strokeOpacity={solid ? SOLID_FOLD_OPACITY : small ? SMALL_OUTLINE_OPACITY : OUTLINE_OPACITY}
							strokeWidth={strokeWidth}
						/>
						{shapes === undefined ? null : (
							<G stroke={solid ? on : color} strokeWidth={strokeWidth} {...(small ? {} : { transform: GLYPH_SCALE })}>
								<GlyphShapes shapes={shapes} />
							</G>
						)}
					</Svg>
				) : null}
				{hasIcon ? <View className="absolute inset-x-0 top-1/4 bottom-0 items-center justify-center">{icon}</View> : null}
				{showLabel ? (
					<View style={bandStyle} className={cn(fileTypeLabelVariants({ tone: paint, solid }), labelClassName)}>
						<Text numberOfLines={1} style={labelStyle} className={cn(fileTypeLabelTextVariants({ tone: paint }), labelTextClassName)}>
							{text}
						</Text>
					</View>
				) : null}
			</View>
		);
	}),
);
