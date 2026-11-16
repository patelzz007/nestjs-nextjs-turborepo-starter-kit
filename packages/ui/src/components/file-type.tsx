"use client";

// Ported from ReUI (https://reui.io/r/base-vega/file-type.json). Exports, props,
// `data-slot` / `data-type` / `data-category` / `data-variant` / `data-size`
// attributes and the resolution rules (`getFileType`, `getFileTypeCategory`)
// match ReUI, so its docs and examples apply, with these deliberate deviations:
// - Colours are the kit's categorical tone tokens (`text-tone-*`), not Tailwind
//   palette steps: brand colours map to the nearest tone, so every type themes in
//   light and dark. The label and solid-glyph colour is the tone's soft fill
//   (`--file-type-foreground`), which meets AA on the tone in both themes.
// - The accessible name ("PDF file", "Spreadsheet") comes from the `fileType`
//   family of `UiKitLabels`, so the component needs a `UiKitLabelsProvider`.
// - `type` / `getFileType` are typed `string` (known names are `FileTypeName`).
// - ReUI's per-style square page (lyra / sera) is dropped: the kit has one style.
// - The root forwards its ref.
// - The type table and the resolution rules live in @workspace/ui-kit-logic (file-type), which the mobile
//   kit's FileType draws from too; this module re-exports them, so its API is unchanged.
import { isStringPrimitive } from "@workspace/shared";
import {
	FILE_TYPE_CATEGORIES,
	FILE_TYPE_EXTENSION_NAMES,
	getFileType,
	getFileTypeCategory,
	resolveFileType,
	type FileTypeCategory,
	type FileTypeName,
	type FileTypeTone,
} from "@workspace/ui-kit-logic";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/* -------------------------------------------------------------------------- */
/*                                   Glyphs                                   */
/* -------------------------------------------------------------------------- */

/*
 * Every glyph is drawn in the 24-unit page grid inside one box, x 7 to 17 and
 * y 10 to 20, so it sits under the fold at the same optical weight, and is
 * shown at 75% of it (full size up to 20px, where every pixel counts).
 * Parallel strokes are at least 3 units apart: the stroke stays 1px at every
 * size, and closer lines merge at `mini` (18px, where a unit is 0.75px).
 */
const STROKE: { readonly vectorEffect: "non-scaling-stroke" } = { vectorEffect: "non-scaling-stroke" };

const GLYPHS: Partial<Record<FileTypeCategory, React.ReactNode>> = {
	document: <path {...STROKE} d="M8 12h8M8 15h5.5M8 18h7" />,
	spreadsheet: (
		<>
			<rect {...STROKE} x="7.5" y="11" width="9" height="8" rx="1" />
			<path {...STROKE} d="M7.5 14.5h9M11 11v8" />
		</>
	),
	presentation: (
		<>
			<rect {...STROKE} x="7" y="11" width="10" height="5.5" rx="1" />
			<path {...STROKE} d="m9.5 19.5 2.5-3 2.5 3" />
		</>
	),
	image: (
		<>
			<path {...STROKE} d="m7 19.5 3.5-5.5 2.75 3.75 1.25-1.75 2.5 3.5Z" />
			<circle {...STROKE} cx="14.25" cy="12" r="1.25" />
		</>
	),
	video: <path {...STROKE} d="M9.5 11v8l7-4Z" />,
	audio: (
		<>
			<path {...STROKE} d="M12.5 18v-7l3 1.5" />
			<circle {...STROKE} cx="10.75" cy="18" r="1.75" />
		</>
	),
	code: <path {...STROKE} d="m10 12-3 3 3 3m4-6 3 3-3 3" />,
	archive: (
		<>
			<rect {...STROKE} x="7" y="11" width="10" height="3" rx="0.75" />
			<path {...STROKE} d="M8 14v4.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V14M11 16.5h2" />
		</>
	),
	design: (
		<>
			<circle {...STROKE} cx="10.5" cy="13" r="2.5" />
			<rect {...STROKE} x="12" y="14.5" width="5" height="5" rx="1" />
		</>
	),
	executable: (
		<>
			<rect {...STROKE} x="7.5" y="10.75" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="13" y="10.75" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="7.5" y="16.25" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="13" y="16.25" width="3.5" height="3.5" rx="0.75" />
		</>
	),
	font: <path {...STROKE} d="M8.5 12.5V11h7v1.5M12 11v8m-1.5 0h3" />,
	folder: <path {...STROKE} d="M7 12a1 1 0 0 1 1-1h2.25a1 1 0 0 1 .8.4l.9 1.1H16a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" />,
};

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

/** The page: 16 by 20 units with 2-unit corners and a rounded 6-unit fold. */
const PAGE_PATH = "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7.586a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V20a2 2 0 0 1-2 2Z";
const FOLD_PATH = "M14 2v5a1 1 0 0 0 1 1h5";
/** The folded corner, traced along the page edge so it never leaves the page. */
const FLAP_PATH = "M13.586 2a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V8h-5a1 1 0 0 1-1-1V2Z";

/**
 * Each tone colours the page through `currentColor`, and sets the text drawn on
 * that colour (the label, the solid glyph) to the tone's soft fill: the pair
 * the token tests hold to AA in both themes.
 */
const TONE_CLASS: Readonly<Record<FileTypeTone, string>> = {
	neutral: "text-muted-foreground [--file-type-foreground:var(--background)]",
	blue: "text-tone-blue [--file-type-foreground:var(--tone-blue-soft)]",
	green: "text-tone-green [--file-type-foreground:var(--tone-green-soft)]",
	yellow: "text-tone-yellow [--file-type-foreground:var(--tone-yellow-soft)]",
	red: "text-tone-red [--file-type-foreground:var(--tone-red-soft)]",
	orange: "text-tone-orange [--file-type-foreground:var(--tone-orange-soft)]",
	teal: "text-tone-teal [--file-type-foreground:var(--tone-teal-soft)]",
	violet: "text-tone-violet [--file-type-foreground:var(--tone-violet-soft)]",
};

/**
 * CSS variable architecture, all read from the root:
 *
 *   --file-type-size        box width and height, set by `size`
 *   --file-type-stroke      line width; unset, 1px up to 40px, then proportional
 *   --file-type-border      page outline in outline, light and mono; unset, 40%
 *                           muted-foreground, 65% up to 20px
 *   --file-type-fill        solid page; unset, the type colour
 *   --file-type-glyph       glyph, custom icon and label in solid; unset, the
 *                           foreground
 *   --file-type-foreground  label text, and the glyph in solid
 *   --file-type-radius      label corners; unset, 10cqw
 *
 * The root is an inline-size container and everything inside is measured in
 * `cqw` against it, so a plain Tailwind size class (`size-20`, `size-full`)
 * resizes the label and stroke with the box, not just the box. The type colour
 * is the root's text colour, so one `text-*` class recolours a type.
 */
const fileTypeVariants = cva("@container relative inline-block size-(--file-type-size) shrink-0 align-middle leading-none select-none", {
	variants: {
		size: {
			mini: "[--file-type-size:--spacing(4.5)]",
			xs: "[--file-type-size:--spacing(6)]",
			sm: "[--file-type-size:--spacing(8)]",
			default: "[--file-type-size:--spacing(10)]",
			lg: "[--file-type-size:--spacing(12)]",
			xl: "[--file-type-size:--spacing(14)]",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

type FileTypeVariant = "outline" | "solid" | "light" | "mono";

type FileTypeSize = NonNullable<VariantProps<typeof fileTypeVariants>["size"]>;

const PAGE_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "fill-transparent stroke-(color:--file-type-outline)",
	light: "fill-muted stroke-(color:--file-type-outline)",
	solid: "fill-[var(--file-type-fill,currentColor)] stroke-[var(--file-type-fill,currentColor)]",
	mono: "fill-transparent stroke-(color:--file-type-outline)",
};

const FOLD_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "stroke-(color:--file-type-outline)",
	light: "stroke-(color:--file-type-outline)",
	solid: "[stroke:color-mix(in_oklab,var(--file-type-foreground)_45%,transparent)]",
	mono: "stroke-(color:--file-type-outline)",
};

/** Solid paints the glyph in the foreground; the others in the type colour, which the tone tokens already lift in dark mode. */
const GLYPH_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "",
	light: "",
	solid: "text-[color:var(--file-type-glyph,var(--file-type-foreground))]",
	mono: "",
};

const LABEL_TEXT_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "text-(color:--file-type-foreground)",
	light: "text-(color:--file-type-foreground)",
	solid: "max-w-[calc(200cqw/3)] text-[color:var(--file-type-glyph,var(--file-type-foreground))]",
	mono: "text-(color:--file-type-foreground)",
};

/**
 * The label overhangs the page's left edge, so it is a band in front of the
 * sheet. Solid has no band: the text sits on the filled page in the glyph's
 * colour, across the page's width. Every label up to 4 characters takes one
 * size, so a row of mixed types reads even; a longer one shrinks to fit.
 */
const LABEL_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "bg-current",
	light: "bg-current",
	solid:
		"left-1/6 w-2/3 px-[3cqw] text-[length:min(20.5cqw,calc(65.6cqw/(var(--file-type-chars)*0.8)))] @max-[21px]:px-0 @max-[21px]:text-[length:min(32.5cqw,5.8px,calc(66cqw/(var(--file-type-chars)*0.9)))]",
	mono: "bg-current",
};

/** The character count the label fit assumes for a non-string label. */
const DEFAULT_LABEL_CHARS = 4;

type FileTypeLabelStyle = React.CSSProperties & Record<`--${string}`, number>;

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

interface FileTypeProps extends Omit<React.ComponentProps<"span">, "children"> {
	/**
	 * An extension (`"pdf"`, `".docx"`), a family (`"image"`, `"folder"`) or
	 * `"empty"`. Unknown extensions render as a neutral file with their label.
	 * Use `getFileType` to resolve a file name or MIME type.
	 */
	readonly type?: string | undefined;
	/** `mono` draws every type in the theme's muted grey instead of its own tone. */
	readonly variant?: FileTypeVariant | undefined;
	/** A preset box size. A Tailwind `size-*` class in `className` overrides it. */
	readonly size?: FileTypeSize | undefined;
	/** Replaces the extension label, for a version tag or a document code. `null` or `""` hides it. */
	readonly label?: React.ReactNode;
	/** Shows the family glyph instead of the label. A family `type` or a type with no label shows its glyph anyway. */
	readonly glyph?: boolean | undefined;
	/** A custom icon drawn on the page in place of the glyph and the label, in the glyph's colour. */
	readonly icon?: React.ReactNode;
	/** Classes for the label badge, merged last. The text is a child of the badge: recolour it with `*:text-*`. */
	readonly labelClassName?: string | undefined;
	/** Per-usage overrides of the `fileType` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"fileType"> | undefined;
}

function hasContent(node: React.ReactNode): boolean {
	return node !== undefined && node !== null && node !== false && node !== "";
}

/** A file-type icon: a page in the type's tone with its extension label or family glyph. Exposed as an image named after the type. */
const FileType = React.forwardRef<HTMLSpanElement, FileTypeProps>(function FileType(
	{ type, variant = "outline", size = "default", label, glyph = false, icon, labelClassName, labels: labelsOverride, className, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("fileType", labelsOverride);
	const resolved = resolveFileType(type);
	// `null` hides the label like "", where `??` would fall back to it.
	const text = label === undefined ? resolved.label : label;
	const hasText = hasContent(text);
	// The name spells out a key its label shortens (DOCKERFILE, not DOCK).
	const spelled = resolved.label === undefined ? undefined : resolved.type.toUpperCase();
	const typeName = spelled === undefined ? labels.categories[resolved.category] : labels.typeFile(spelled);
	// A custom string label is part of what the icon says ("V3, DOCX file").
	const custom = isStringPrimitive(label) ? label : "";
	const customUpper = custom.toUpperCase();
	const name = custom !== "" && customUpper !== resolved.label && customUpper !== spelled ? labels.labelledType(custom, typeName) : typeName;
	const hasIcon = hasContent(icon);
	const showLabel = hasText && !glyph && !hasIcon;
	const glyphNode = showLabel || hasIcon ? null : GLYPHS[resolved.category];
	const labelStyle = React.useMemo((): FileTypeLabelStyle => ({ "--file-type-chars": isStringPrimitive(text) ? text.length : DEFAULT_LABEL_CHARS }), [text]);

	return (
		<span
			ref={ref}
			role="img"
			aria-label={name}
			data-slot="file-type"
			data-type={resolved.type}
			data-category={resolved.category}
			data-tone={variant === "mono" ? "neutral" : resolved.tone}
			data-variant={variant}
			data-size={size}
			className={cn(fileTypeVariants({ size }), TONE_CLASS[variant === "mono" ? "neutral" : resolved.tone], className)}
			{...props}>
			<svg
				data-slot="file-type-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				focusable="false"
				className="absolute inset-0 size-full overflow-visible [stroke-width:var(--file-type-stroke,max(1px,2.5cqw))] [--file-type-outline:var(--file-type-border,color-mix(in_oklab,var(--muted-foreground)_40%,transparent))] @max-[21px]:[--file-type-outline:var(--file-type-border,color-mix(in_oklab,var(--muted-foreground)_65%,transparent))]">
				<path {...STROKE} d={PAGE_PATH} className={PAGE_CLASS[variant]} />
				{variant === "solid" ? <path d={FLAP_PATH} className="[fill:color-mix(in_oklab,var(--file-type-foreground)_30%,transparent)] stroke-none" /> : null}
				<path {...STROKE} d={FOLD_PATH} className={FOLD_CLASS[variant]} />
				{glyphNode === null || glyphNode === undefined ? null : (
					<g data-slot="file-type-glyph" stroke="currentColor" className={cn("origin-[12px_15px] scale-75 @max-[21px]:scale-100", GLYPH_CLASS[variant])}>
						{glyphNode}
					</g>
				)}
			</svg>
			{hasIcon ? (
				<span
					data-slot="file-type-custom-icon"
					aria-hidden="true"
					className={cn(
						"absolute top-[62.5%] left-1/2 flex size-[37.5cqw] -translate-1/2 items-center justify-center @max-[21px]:size-[50cqw] [&>svg]:size-full",
						GLYPH_CLASS[variant],
					)}>
					{icon}
				</span>
			) : null}
			{showLabel ? (
				<span
					data-slot="file-type-label"
					style={labelStyle}
					className={cn(
						"absolute top-(--file-type-label-y) left-[5%] flex h-(--file-type-label-h) max-w-[95%] items-center justify-center overflow-hidden rounded-[var(--file-type-radius,var(--file-type-label-radius,10cqw))] px-[var(--file-type-label-px,7cqw)] font-medium whitespace-nowrap",
						"text-[length:min(24cqw,calc((95cqw-2*var(--file-type-label-px,7cqw))/(var(--file-type-chars)*0.72)))] [--file-type-label-h:35%] [--file-type-label-y:45%]",
						"supports-[margin:round(1cap,1px)]:mt-[calc(round(nearest,calc(var(--file-type-label-y)+(var(--file-type-label-h)+1cap)/2),1px)-var(--file-type-label-y)-(var(--file-type-label-h)+1cap)/2)]",
						"@max-[21px]:px-[4cqw] @max-[21px]:text-[length:min(32.5cqw,5.8px,calc(87cqw/(var(--file-type-chars)*0.88)))] @max-[21px]:font-semibold @max-[21px]:[--file-type-label-h:45%] @max-[21px]:[--file-type-label-y:40%]",
						"[--file-type-label-px:7cqw] [--file-type-label-radius:10cqw]",
						LABEL_CLASS[variant],
						labelClassName,
					)}>
					<span
						className={cn(
							"max-w-[min(95cqw,calc(100%+2*max(0px,var(--file-type-label-px,7cqw)-7cqw)))] shrink-0 truncate py-[0.25em] [text-box:trim-both_cap_alphabetic] @max-[21px]:max-w-full",
							LABEL_TEXT_CLASS[variant],
						)}>
						{text}
					</span>
				</span>
			) : null}
		</span>
	);
});

export {
	FILE_TYPE_CATEGORIES,
	FILE_TYPE_EXTENSION_NAMES,
	FileType,
	fileTypeVariants,
	getFileType,
	getFileTypeCategory,
	type FileTypeCategory,
	type FileTypeName,
	type FileTypeProps,
	type FileTypeSize,
	type FileTypeTone,
	type FileTypeVariant,
};
