"use client";

// Ported from ReUI (https://reui.io/r/base-vega/signature-pad.json). Part names,
// props, `data-slot` / `data-*` attributes, the stroke model, export helpers and
// the `useSignaturePad` API match ReUI, so its docs and examples apply, with
// these deliberate deviations:
// - Every part forwards its ref (`SignaturePadArea` to the drawing surface).
// - Default copy (the area's name, its spoken status, the placeholder, the
//   controls' names, the preview's name) comes from the `signaturePad` family
//   of `UiKitLabels`; `labels` on `SignaturePad` overrides single strings.
// - Ink is a token: on screen it follows `currentColor` (the area's
//   `text-foreground`), and the pad's own exports default to the area's
//   computed colour — and, for JPEG, the computed `--background` — instead of
//   hex literals. The standalone helpers (`signaturePadToSVG`, …) fall back to
//   `currentColor` / the `CanvasText` and `Canvas` system colours; pass
//   `color` / `background` for paper.
// - `SignaturePadArea` takes a CVA `state` (disabled / invalid via
//   `aria-invalid`), resolved with `resolveFieldState`, beside its `variant`.
// - As in reui, the area is a focusable `role="application"` that owns its
//   undo / redo shortcuts (⌘Z, ⌘⇧Z, ⌘Y). Keydowns from the pinned controls
//   bubble to it, so one handler serves both; `api.focus()` focuses the area.
//   jsx-a11y classifies `application` as non-interactive, so this file is the
//   repo's one approved lint exception (`approvedRuleExceptions` in
//   packages/eslint-config/react-internal.js) — do not copy the pattern.
//   A form error is spoken through `aria-invalid` and `aria-describedby`.
//   The long-press callout is blocked in CSS (`touch-none`, `select-none`,
//   `-webkit-touch-callout:none`), so no context-menu handler is needed.
// - Runtime checks use zod and named constants (pointer types, the coalesced
//   events probe), per the kit's rules; behaviour is unchanged.
import { hasGlobalValue } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { BrushCleaningIcon, Redo2Icon, SaveIcon, Undo2Icon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** CSS pixels from the area's top-left corner, and the ink diameter there. */
export type SignaturePadPoint = [x: number, y: number, size: number];

export interface SignaturePadStroke {
	readonly points: SignaturePadPoint[];
	/** Recorded only when the pad has a `color`; otherwise the ink follows `currentColor`. */
	readonly color?: string;
}

const SignaturePadPointerTypeSchema = z.enum(["mouse", "pen", "touch"]);

export type SignaturePadPointerType = z.infer<typeof SignaturePadPointerTypeSchema>;

/**
 * `auto` reads pen pressure and falls back to speed for mouse and touch,
 * whose `pressure` is a constant 0.5 on most hardware.
 */
export type SignaturePadSizing = "auto" | "pressure" | "velocity";

/** Data URLs for the image formats, the raw strokes for `json`. */
export type SignaturePadFormat = "png" | "jpeg" | "svg" | "json";

export type SignaturePadRasterType = "image/png" | "image/jpeg" | "image/webp";

export interface SignaturePadExportOptions {
	/** A fixed frame from the area's origin. Without both, the image is cropped to the ink. */
	readonly width?: number | undefined;
	readonly height?: number | undefined;
	/** Space kept around the ink when cropping. */
	readonly padding?: number | undefined;
	/** `false` keeps the area's origin instead of cropping to the ink. */
	readonly crop?: boolean | undefined;
	/** Ink for strokes that carry no colour of their own. */
	readonly color?: string | undefined;
	readonly background?: string | undefined;
	/** Raster only: pixels per CSS pixel. */
	readonly scale?: number | undefined;
	/** Raster only. */
	readonly type?: SignaturePadRasterType | undefined;
	readonly quality?: number | undefined;
}

/** Copy for the pad — the `signaturePad` family of `UiKitLabels`. */
export interface SignaturePadLabels {
	/** Accessible name of the drawing area, unless it has its own `aria-label` / `aria-labelledby`. */
	readonly area: string;
	/** `aria-roledescription` of the drawing area. */
	readonly roleDescription: string;
	/** Spoken status while the pad holds no ink. */
	readonly empty: string;
	/** Spoken status once the pad holds ink. */
	readonly signed: string;
	/** The status of a read-only pad ("Signed" → "Signed, read only"). */
	readonly readOnlyStatus: (status: string) => string;
	/** `SignaturePadPlaceholder` text. */
	readonly placeholder: string;
	readonly clear: string;
	readonly undo: string;
	readonly redo: string;
	readonly save: string;
	/** Accessible name of the `SignaturePadControls` group. */
	readonly controls: string;
	/** Accessible name of `SignaturePadPreview`. */
	readonly preview: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

/** Path coordinates keep two decimals. */
const PATH_PRECISION = 100;
/** The smallest dot a tap leaves, in CSS pixels. */
const MIN_DOT_RADIUS = 0.25;
/* Past ~100 degrees the averaged tangent flips and the outline pinches, so a
   stroke is split there and each piece gets its own round caps. */
const CORNER_COS = -0.17;
/** Neighbours closer than this share the previous normal. */
const MIN_NORMAL_LENGTH = 1e-6;

type Offset = readonly [x: number, y: number];

const round = (value: number): number => Math.round(value * PATH_PRECISION) / PATH_PRECISION;
const pair = (x: number, y: number): string => `${String(round(x))} ${String(round(y))}`;
const pairOf = ([x, y]: Offset): string => pair(x, y);

function circlePath(x: number, y: number, r: number): string {
	const radius = round(Math.max(r, MIN_DOT_RADIUS));
	const diameter = String(round(radius * 2));
	const back = String(round(-radius * 2));
	return `M${pair(x - radius, y)}a${String(radius)} ${String(radius)} 0 1 0 ${diameter} 0a${String(radius)} ${String(radius)} 0 1 0 ${back} 0Z`;
}

function midpoint([x, y]: Offset, [nextX, nextY]: Offset): string {
	return pair((x + nextX) / 2, (y + nextY) / 2);
}

/**
 * One filled outline: the left offset forward, a round cap, the right offset
 * back, a round cap. Every arc sweeps the same way as the outline itself, so
 * overlapping pieces and self-crossing loops add up under the default
 * `nonzero` fill instead of punching holes.
 */
function outlinePath(segment: readonly SignaturePadPoint[]): string {
	const [start] = segment;
	const end = segment.at(-1);
	if (start === undefined || end === undefined) {
		return "";
	}
	const [startX, startY, startSize] = start;
	if (segment.length === 1) {
		return circlePath(startX, startY, startSize / 2);
	}

	const left: Offset[] = [];
	const right: Offset[] = [];
	let nx = 0;
	let ny = 1;
	segment.forEach((point, index): void => {
		const [ax, ay] = segment[index - 1] ?? point;
		const [bx, by] = segment[index + 1] ?? point;
		const length = Math.hypot(bx - ax, by - ay);
		if (length > MIN_NORMAL_LENGTH) {
			nx = -(by - ay) / length;
			ny = (bx - ax) / length;
		}
		const [x, y, size] = point;
		const r = size / 2;
		left.push([x + nx * r, y + ny * r]);
		right.push([x - nx * r, y - ny * r]);
	});

	const [firstLeft] = left;
	const [firstRight] = right;
	const lastLeft = left.at(-1);
	const lastRight = right.at(-1);
	if (firstLeft === undefined || firstRight === undefined || lastLeft === undefined || lastRight === undefined) {
		return "";
	}
	const [, , endSize] = end;
	const endRadius = String(round(endSize / 2));
	const startRadius = String(round(startSize / 2));
	const last = left.length - 1;

	let d = `M${pairOf(firstLeft)}`;
	for (let index = 1; index < last; index++) {
		const current = left[index];
		const next = left[index + 1];
		if (current !== undefined && next !== undefined) {
			d += `Q${pairOf(current)} ${midpoint(current, next)}`;
		}
	}
	d += `L${pairOf(lastLeft)}A${endRadius} ${endRadius} 0 0 0 ${pairOf(lastRight)}`;
	for (let index = last - 1; index > 0; index--) {
		const current = right[index];
		const previous = right[index - 1];
		if (current !== undefined && previous !== undefined) {
			d += `Q${pairOf(current)} ${midpoint(current, previous)}`;
		}
	}
	return `${d}L${pairOf(firstRight)}A${startRadius} ${startRadius} 0 0 0 ${pairOf(firstLeft)}Z`;
}

function isCorner([ax, ay]: SignaturePadPoint, [bx, by]: SignaturePadPoint, [cx, cy]: SignaturePadPoint): boolean {
	const ux = bx - ax;
	const uy = by - ay;
	const vx = cx - bx;
	const vy = cy - by;
	const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
	return lengths > 0 && (ux * vx + uy * vy) / lengths < CORNER_COS;
}

/** The SVG path data of one stroke's filled outline, shared by the pad and every export. */
function getSignaturePadStrokePath(stroke: SignaturePadStroke): string {
	const { points } = stroke;
	if (points.length === 0) {
		return "";
	}
	let d = "";
	let start = 0;
	for (let index = 1; index < points.length - 1; index++) {
		const previous = points[index - 1];
		const current = points[index];
		const next = points[index + 1];
		if (previous !== undefined && current !== undefined && next !== undefined && isCorner(previous, current, next)) {
			d += outlinePath(points.slice(start, index + 1));
			start = index;
		}
	}
	return d + outlinePath(points.slice(start));
}

export interface SignaturePadBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** The ink's bounding box, stroke width included, or `null` when there is no ink. */
function getSignaturePadBounds(strokes: readonly SignaturePadStroke[]): SignaturePadBounds | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const stroke of strokes) {
		for (const [x, y, size] of stroke.points) {
			const r = size / 2;
			minX = Math.min(minX, x - r);
			minY = Math.min(minY, y - r);
			maxX = Math.max(maxX, x + r);
			maxY = Math.max(maxY, y + r);
		}
	}
	if (minX === Infinity) {
		return null;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/* -------------------------------------------------------------------------- */
/*                                   Export                                   */
/* -------------------------------------------------------------------------- */

/** Space kept around the ink when an export crops to it. */
const DEFAULT_EXPORT_PADDING = 8;
/** Space kept around the ink in `SignaturePadPreview`. */
const DEFAULT_PREVIEW_PADDING = 4;
/** Raster pixels per CSS pixel, so an export stays sharp on a high-density screen. */
const DEFAULT_RASTER_SCALE = 2;
/** The size of an empty export's frame. */
const EMPTY_FRAME_SIZE = 1;
/** Ink of the standalone SVG export: inherits where the SVG is inlined, black in a viewer. */
const SVG_INK_FALLBACK = "currentColor";
/** System colours (theme-aware, not literals) for a raster export with no area to read tokens from. */
const RASTER_INK_FALLBACK = "CanvasText";
const RASTER_PAPER_FALLBACK = "Canvas";
const BACKGROUND_TOKEN = "--background";

function resolveFrame(strokes: readonly SignaturePadStroke[], options: SignaturePadExportOptions): SignaturePadBounds {
	const { width, height, padding = DEFAULT_EXPORT_PADDING, crop = true } = options;
	if (width !== undefined && height !== undefined) {
		return { x: 0, y: 0, width, height };
	}
	const bounds = getSignaturePadBounds(strokes);
	if (bounds === null) {
		return { x: 0, y: 0, width: width ?? EMPTY_FRAME_SIZE, height: height ?? EMPTY_FRAME_SIZE };
	}
	if (!crop) {
		return {
			x: 0,
			y: 0,
			width: width ?? Math.ceil(bounds.x + bounds.width + padding),
			height: height ?? Math.ceil(bounds.y + bounds.height + padding),
		};
	}
	/* Round the edges, not the size: flooring x and ceiling only the width
	   could leave the right and bottom edges up to 1px inside the ink. */
	const x = Math.floor(bounds.x - padding);
	const y = Math.floor(bounds.y - padding);
	return { x, y, width: Math.ceil(bounds.x + bounds.width + padding) - x, height: Math.ceil(bounds.y + bounds.height + padding) - y };
}

const ATTRIBUTE_SPECIALS = /[&"<>]/g;
const escapeAttribute = (value: string): string => value.replace(ATTRIBUTE_SPECIALS, (char): string => `&#${String(char.charCodeAt(0))};`);

/** A standalone SVG document string. */
function signaturePadToSVG(strokes: readonly SignaturePadStroke[], options: SignaturePadExportOptions = {}): string {
	const { x, y, width, height } = resolveFrame(strokes, options);
	const color = options.color ?? SVG_INK_FALLBACK;
	const frame = `x="${String(x)}" y="${String(y)}" width="${String(width)}" height="${String(height)}"`;
	const background = options.background === undefined || options.background === "" ? "" : `<rect ${frame} fill="${escapeAttribute(options.background)}"/>`;
	const paths = strokes
		.map((stroke): string => {
			const d = getSignaturePadStrokePath(stroke);
			return d === "" ? "" : `<path d="${d}" fill="${escapeAttribute(stroke.color ?? color)}"/>`;
		})
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${String(x)} ${String(y)} ${String(width)} ${String(height)}" width="${String(width)}" height="${String(height)}">${background}${paths}</svg>`;
}

/** The CSS variable's value on the document root, or `""` outside a browser. */
function readRootToken(name: string): string {
	if (!hasGlobalValue("document")) {
		return "";
	}
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawToCanvas(strokes: readonly SignaturePadStroke[], options: SignaturePadExportOptions): HTMLCanvasElement {
	const { x, y, width, height } = resolveFrame(strokes, options);
	const scale = options.scale ?? DEFAULT_RASTER_SCALE;
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));

	const context = canvas.getContext("2d");
	if (context === null) {
		return canvas;
	}
	context.scale(scale, scale);
	context.translate(-x, -y);

	/* JPEG has no alpha, so transparent ink would land on black: it gets the theme's page colour. */
	const background = options.background ?? (options.type === "image/jpeg" ? readRootToken(BACKGROUND_TOKEN) || RASTER_PAPER_FALLBACK : "");
	if (background !== "") {
		context.fillStyle = background;
		context.fillRect(x, y, width, height);
	}
	for (const stroke of strokes) {
		const d = getSignaturePadStrokePath(stroke);
		if (d !== "") {
			context.fillStyle = stroke.color ?? options.color ?? RASTER_INK_FALLBACK;
			context.fill(new Path2D(d));
		}
	}
	return canvas;
}

/** A PNG data URL, or `type`. Browser only: call it from a handler or an effect, never while rendering. */
function signaturePadToDataURL(strokes: readonly SignaturePadStroke[], options: SignaturePadExportOptions = {}): string {
	return drawToCanvas(strokes, options).toDataURL(options.type ?? "image/png", options.quality);
}

/** For uploads: a `Blob` skips the base64 inflation of a data URL. Browser only. */
function signaturePadToBlob(strokes: readonly SignaturePadStroke[], options: SignaturePadExportOptions = {}): Promise<Blob | null> {
	return new Promise<Blob | null>((resolve): void => {
		drawToCanvas(strokes, options).toBlob(resolve, options.type ?? "image/png", options.quality);
	});
}

/** One string per format, and `""` for an empty pad so a `required` field fails. `png` and `jpeg` need a browser. */
function serializeSignaturePad(strokes: readonly SignaturePadStroke[], format: SignaturePadFormat = "svg", options: SignaturePadExportOptions = {}): string {
	if (strokes.length === 0) {
		return "";
	}
	if (format === "json") {
		return JSON.stringify(strokes);
	}
	if (format === "svg") {
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(signaturePadToSVG(strokes, options))}`;
	}
	return signaturePadToDataURL(strokes, { ...options, type: format === "jpeg" ? "image/jpeg" : "image/png" });
}

/* -------------------------------------------------------------------------- */
/*                                   Context                                  */
/* -------------------------------------------------------------------------- */

export interface SignaturePadApi {
	readonly strokes: SignaturePadStroke[];
	readonly isEmpty: boolean;
	readonly isDrawing: boolean;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly disabled: boolean;
	readonly readOnly: boolean;
	readonly clear: () => void;
	readonly undo: () => void;
	readonly redo: () => void;
	/** Moves focus to the first enabled control of the pad (the area itself is not a tab stop). */
	readonly focus: () => void;
	/** With `crop: false` and no size, these four frame the whole area as rendered. */
	readonly toSVG: (options?: SignaturePadExportOptions) => string;
	readonly toDataURL: (options?: SignaturePadExportOptions) => string;
	readonly toBlob: (options?: SignaturePadExportOptions) => Promise<Blob | null>;
	readonly serialize: (format?: SignaturePadFormat, options?: SignaturePadExportOptions) => string;
}

interface SignaturePadConfig {
	readonly color: string | undefined;
	readonly minWidth: number;
	readonly maxWidth: number;
	readonly smoothing: number;
	readonly sizing: SignaturePadSizing;
	readonly pointerTypes: readonly SignaturePadPointerType[] | undefined;
	readonly name: string | undefined;
	readonly form: string | undefined;
	readonly required: boolean;
	readonly format: SignaturePadFormat;
	readonly interactive: boolean;
	readonly undoDepth: number;
	readonly redoDepth: number;
	readonly labels: SignaturePadLabels;
	readonly setArea: (node: HTMLDivElement | null) => void;
	readonly setDrawing: (drawing: boolean) => void;
	readonly commitStroke: (stroke: SignaturePadStroke) => void;
	readonly resetToDefault: () => void;
	readonly onStrokeStart: ((details: { readonly pointerType: SignaturePadPointerType }) => void) | undefined;
}

const SignaturePadContext = React.createContext<SignaturePadApi | null>(null);
const SignaturePadConfigContext = React.createContext<SignaturePadConfig | null>(null);

/** The nearest pad's state and actions. Throws outside a `SignaturePad`. */
function useSignaturePad(): SignaturePadApi {
	const context = React.useContext(SignaturePadContext);
	if (context === null) {
		throw new Error("useSignaturePad must be used within a SignaturePad");
	}
	return context;
}

function useSignaturePadConfig(part: string): SignaturePadConfig {
	const context = React.useContext(SignaturePadConfigContext);
	if (context === null) {
		throw new Error(`${part} must be used within a SignaturePad`);
	}
	return context;
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

/** Undo steps kept. */
const HISTORY_LIMIT = 100;
const DEFAULT_MIN_WIDTH = 0.8;
const DEFAULT_MAX_WIDTH = 3.2;
const DEFAULT_SMOOTHING = 0.5;

function samePoint(a: SignaturePadPoint | undefined, b: SignaturePadPoint | undefined): boolean {
	return a?.join() === b?.join();
}

/* Structural, not identity: react-hook-form and other stores hand back a
   deep copy of the value, and identity alone read every copy as an outside
   change and voided undo. First and last point are enough to tell a copy from
   a real edit. */
function sameStrokes(a: readonly SignaturePadStroke[], b: readonly SignaturePadStroke[]): boolean {
	if (a === b) {
		return true;
	}
	if (a.length !== b.length) {
		return false;
	}
	return a.every((stroke, index): boolean => {
		const other = b[index];
		if (other === undefined) {
			return false;
		}
		if (stroke === other) {
			return true;
		}
		const { points } = stroke;
		return (
			stroke.color === other.color && points.length === other.points.length && samePoint(points.at(0), other.points.at(0)) && samePoint(points.at(-1), other.points.at(-1))
		);
	});
}

interface History {
	readonly past: SignaturePadStroke[][];
	readonly future: SignaturePadStroke[][];
	/** The value this history leads to. A value it does not match came from outside, and the history is void. */
	readonly present: SignaturePadStroke[];
}

type HandleKey = readonly [strokes: SignaturePadStroke[], history: History, isDrawing: boolean, disabled: boolean, readOnly: boolean];

function sameHandleKey([strokesA, historyA, drawingA, disabledA, readOnlyA]: HandleKey, [strokesB, historyB, drawingB, disabledB, readOnlyB]: HandleKey): boolean {
	return strokesA === strokesB && historyA === historyB && drawingA === drawingB && disabledA === disabledB && readOnlyA === readOnlyB;
}

/** A handle whose members read the latest render's API, so it can stay one object across renders. */
function createLiveApi(source: React.RefObject<SignaturePadApi>): SignaturePadApi {
	return {
		get strokes(): SignaturePadStroke[] {
			return source.current.strokes;
		},
		get isEmpty(): boolean {
			return source.current.isEmpty;
		},
		get isDrawing(): boolean {
			return source.current.isDrawing;
		},
		get canUndo(): boolean {
			return source.current.canUndo;
		},
		get canRedo(): boolean {
			return source.current.canRedo;
		},
		get disabled(): boolean {
			return source.current.disabled;
		},
		get readOnly(): boolean {
			return source.current.readOnly;
		},
		clear: (): void => {
			source.current.clear();
		},
		undo: (): void => {
			source.current.undo();
		},
		redo: (): void => {
			source.current.redo();
		},
		focus: (): void => {
			source.current.focus();
		},
		toSVG: (options): string => source.current.toSVG(options),
		toDataURL: (options): string => source.current.toDataURL(options),
		toBlob: (options): Promise<Blob | null> => source.current.toBlob(options),
		serialize: (format, options): string => source.current.serialize(format, options),
	};
}

/** The area's own token-driven colours as export defaults, and its rendered size for `crop: false`. */
function withAreaDefaults(area: HTMLDivElement | null, options: SignaturePadExportOptions = {}): SignaturePadExportOptions {
	if (area === null) {
		return options;
	}
	const computed = getComputedStyle(area);
	const ink = computed.color === "" ? undefined : computed.color;
	const paper = computed.getPropertyValue(BACKGROUND_TOKEN).trim();
	const background = options.type === "image/jpeg" && paper !== "" ? paper : undefined;
	const framed = options.crop === false ? { width: options.width ?? area.clientWidth, height: options.height ?? area.clientHeight } : {};
	return { color: ink, background, ...options, ...framed };
}

export interface SignaturePadProps extends Omit<React.ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange"> {
	/** Strokes are compared by content, so a copy of the same value keeps undo; a different value from outside clears it. */
	readonly value?: SignaturePadStroke[] | undefined;
	readonly defaultValue?: SignaturePadStroke[] | undefined;
	/** Fires once per finished stroke, and on clear, undo and redo. Never per pointer move. */
	readonly onValueChange?: ((value: SignaturePadStroke[]) => void) | undefined;
	readonly onStrokeStart?: ((details: { readonly pointerType: SignaturePadPointerType }) => void) | undefined;
	readonly onStrokeEnd?: ((stroke: SignaturePadStroke) => void) | undefined;
	/** The pad's API, for code outside the tree (a form library, a toolbar elsewhere). */
	readonly apiRef?: React.Ref<SignaturePadApi> | undefined;
	/** Any CSS colour, recorded on each stroke. Unset, the ink follows the area's text colour, so it tracks the theme. */
	readonly color?: string | undefined;
	/** Ink diameter range in CSS pixels. Equal values draw a constant line. */
	readonly minWidth?: number | undefined;
	readonly maxWidth?: number | undefined;
	/** 0 is raw input; higher trades a little lag for smoother curves. */
	readonly smoothing?: number | undefined;
	readonly sizing?: SignaturePadSizing | undefined;
	/** Accept only these pointers, e.g. `["pen"]` to ignore a resting palm. */
	readonly pointerTypes?: readonly SignaturePadPointerType[] | undefined;
	readonly disabled?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	/** Submits the signature with a native form under this name. */
	readonly name?: string | undefined;
	readonly form?: string | undefined;
	readonly required?: boolean | undefined;
	/** What the form field carries. `png` and `jpeg` rasterize on every stroke; `svg` is a string build. */
	readonly format?: SignaturePadFormat | undefined;
	/** Per-usage overrides of the `signaturePad` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"signaturePad"> | undefined;
}

const NO_STROKES: SignaturePadStroke[] = [];

/**
 * A signature field: pressure- and velocity-weighted ink from mouse, touch or
 * stylus, undo / redo (also ⌘Z / ⌘⇧Z / ⌘Y on the area), native form
 * submission and PNG / JPEG / SVG / JSON export. Controlled (`value` +
 * `onValueChange`) or uncontrolled (`defaultValue`).
 */
const SignaturePad = React.forwardRef<HTMLDivElement, SignaturePadProps>(function SignaturePad(
	{
		value,
		defaultValue,
		onValueChange,
		onStrokeStart,
		onStrokeEnd,
		apiRef,
		color,
		minWidth = DEFAULT_MIN_WIDTH,
		maxWidth = DEFAULT_MAX_WIDTH,
		smoothing = DEFAULT_SMOOTHING,
		sizing = "auto",
		pointerTypes,
		disabled = false,
		readOnly = false,
		name,
		form,
		required = false,
		format = "svg",
		labels: labelsOverride,
		className,
		children,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("signaturePad", labelsOverride);
	const [uncontrolled, setUncontrolled] = React.useState<SignaturePadStroke[]>(defaultValue ?? NO_STROKES);
	const strokes = value ?? uncontrolled;
	/* What a form reset restores, as a native field returns to its default. */
	const [initialValue] = React.useState<SignaturePadStroke[]>(defaultValue ?? NO_STROKES);
	const [history, setHistory] = React.useState<History>({ past: [], future: [], present: strokes });
	const [isDrawing, setDrawing] = React.useState(false);
	const areaRef = React.useRef<HTMLDivElement | null>(null);

	const synced = sameStrokes(history.present, strokes);
	const past = synced ? history.past : [];
	const future = synced ? history.future : [];

	const setStrokes = (next: SignaturePadStroke[], nextHistory: History): void => {
		setHistory(nextHistory);
		if (value === undefined) {
			setUncontrolled(next);
		}
		onValueChange?.(next);
	};

	const commit = (next: SignaturePadStroke[]): void => {
		setStrokes(next, { past: [...past, strokes].slice(-HISTORY_LIMIT), future: [], present: next });
	};

	const api: SignaturePadApi = {
		strokes,
		isEmpty: strokes.length === 0,
		isDrawing,
		canUndo: past.length > 0,
		canRedo: future.length > 0,
		disabled,
		readOnly,
		clear: (): void => {
			if (strokes.length > 0) {
				commit([]);
			}
		},
		undo: (): void => {
			const previous = past.at(-1);
			if (previous === undefined) {
				return;
			}
			setStrokes(previous, { past: past.slice(0, -1), future: [strokes, ...future], present: previous });
		},
		redo: (): void => {
			const [next, ...rest] = future;
			if (next === undefined) {
				return;
			}
			setStrokes(next, { past: [...past, strokes], future: rest, present: next });
		},
		focus: (): void => {
			areaRef.current?.focus({ preventScroll: true });
		},
		toSVG: (options): string => signaturePadToSVG(strokes, withAreaDefaults(areaRef.current, options)),
		toDataURL: (options): string => signaturePadToDataURL(strokes, withAreaDefaults(areaRef.current, options)),
		toBlob: (options): Promise<Blob | null> => signaturePadToBlob(strokes, withAreaDefaults(areaRef.current, options)),
		serialize: (serializeFormat, options): string => serializeSignaturePad(strokes, serializeFormat, withAreaDefaults(areaRef.current, options)),
	};

	/* Members read the latest render through getters, and the object is
	   rebuilt only when the pad's state changes. A handle rebuilt on every
	   render made a state-setter `apiRef` loop until React threw; a handle
	   that never changed left such a consumer frozen at its mount state. */
	const latestApi = React.useRef<SignaturePadApi>(api);
	const handleRef = React.useRef<{ readonly key: HandleKey; readonly handle: SignaturePadApi } | null>(null);
	React.useLayoutEffect((): void => {
		latestApi.current = api;
	});
	React.useImperativeHandle(apiRef, (): SignaturePadApi => {
		const key: HandleKey = [strokes, history, isDrawing, disabled, readOnly];
		const cached = handleRef.current;
		if (cached !== null && sameHandleKey(cached.key, key)) {
			return cached.handle;
		}
		const handle = createLiveApi(latestApi);
		handleRef.current = { key, handle };
		return handle;
	}, [strokes, history, isDrawing, disabled, readOnly]);

	const config: SignaturePadConfig = {
		color,
		minWidth,
		maxWidth: Math.max(minWidth, maxWidth),
		smoothing: Math.min(Math.max(smoothing, 0), 1),
		sizing,
		pointerTypes,
		name,
		form,
		required,
		format,
		interactive: !disabled && !readOnly,
		undoDepth: past.length,
		redoDepth: future.length,
		labels,
		setArea: (node): void => {
			areaRef.current = node;
		},
		setDrawing,
		commitStroke: (stroke): void => {
			commit([...strokes, stroke]);
			onStrokeEnd?.(stroke);
		},
		resetToDefault: (): void => {
			if (!sameStrokes(strokes, initialValue)) {
				commit(initialValue);
			}
		},
		onStrokeStart,
	};

	return (
		<SignaturePadContext.Provider value={api}>
			<SignaturePadConfigContext.Provider value={config}>
				<div
					ref={ref}
					data-slot="signature-pad"
					data-empty={strokes.length === 0 ? true : undefined}
					data-drawing={isDrawing ? true : undefined}
					data-disabled={disabled ? true : undefined}
					data-readonly={readOnly ? true : undefined}
					className={cn("flex w-full flex-col gap-2", className)}
					{...props}>
					{children}
				</div>
			</SignaturePadConfigContext.Provider>
		</SignaturePadContext.Provider>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Area                                    */
/* -------------------------------------------------------------------------- */

/* Radius, focus and invalid rings follow the textarea, so the pad reads as the
   same kind of control. A div never matches `:disabled`, so the disabled and
   invalid looks are the `state` axis. */
const signaturePadAreaVariants = cva(
	"relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-md border text-foreground transition-[color,box-shadow] outline-none select-none [-webkit-touch-callout:none] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-readonly:cursor-default motion-reduce:transition-none",
	{
		variants: {
			/** `muted` is a filled surface; `ghost` drops the chrome for a card or document that has its own. */
			variant: {
				default: "border-input bg-transparent shadow-xs dark:bg-input/30",
				muted: "border-border bg-muted/50",
				ghost: "border-transparent bg-transparent",
			},
			state: {
				default: "",
				loading: "cursor-wait opacity-70",
				disabled: "cursor-not-allowed opacity-50",
				error: "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
			},
		},
		defaultVariants: {
			variant: "default",
			state: "default",
		},
	},
);

interface LiveStroke {
	readonly pointerId: number;
	readonly pointerType: SignaturePadPointerType;
	readonly points: SignaturePadPoint[];
	readonly left: number;
	readonly top: number;
	readonly scaleX: number;
	readonly scaleY: number;
	time: number;
	velocity: number;
	size: number;
	/* The unsmoothed last position. Streamline trails the pointer, so without
	   it a stroke lifted in motion ended short (12px on a fast 200px line). */
	rawX: number;
	rawY: number;
}

/** A pen at rest is slow, so a stroke starts near full width (a tap at the midpoint left a dot a third the weight of the line). */
const RESTING_WIDTH_RATIO = 0.8;
/** How far streamline smoothing can hold a point back from the pointer, at full `smoothing`. */
const STREAMLINE_STRENGTH = 0.85;
/** Smoothed samples closer than this (CSS px) to the previous point are dropped. */
const MIN_SAMPLE_DISTANCE = 0.75;
/** Floor for the time between samples, so two samples in one millisecond do not divide by zero. */
const MIN_SAMPLE_INTERVAL_MS = 1;
/** Weight of the previous velocity in the running average (the new sample takes the rest). */
const VELOCITY_MEMORY = 0.3;
/** How quickly the ink width eases toward its target per sample. */
const WIDTH_EASING = 0.35;
/** The raw end point is appended when the smoothed line stops at least this far (CSS px) short of it. */
const MIN_TAIL_DISTANCE = 0.5;
const PRIMARY_MOUSE_BUTTON = 0;

function addSample(live: LiveStroke, config: SignaturePadConfig, clientX: number, clientY: number, pressure: number, time: number): void {
	const x = (clientX - live.left) * live.scaleX;
	const y = (clientY - live.top) * live.scaleY;
	live.rawX = x;
	live.rawY = y;
	const { minWidth, maxWidth, sizing, smoothing } = config;
	const usePressure = sizing === "pressure" || (sizing === "auto" && live.pointerType === "pen");
	const pressed = minWidth + (maxWidth - minWidth) * Math.min(pressure, 1);
	const previous = live.points.at(-1);

	if (previous === undefined) {
		live.size = usePressure ? pressed : minWidth + (maxWidth - minWidth) * RESTING_WIDTH_RATIO;
		live.time = time;
		live.points.push([round(x), round(y), round(live.size)]);
		return;
	}

	/* Streamline: each point moves only part of the way toward the pointer. */
	const [previousX, previousY] = previous;
	const follow = 1 - smoothing * STREAMLINE_STRENGTH;
	const sx = previousX + (x - previousX) * follow;
	const sy = previousY + (y - previousY) * follow;
	const distance = Math.hypot(sx - previousX, sy - previousY);
	if (distance < MIN_SAMPLE_DISTANCE) {
		return;
	}
	const speed = distance / Math.max(time - live.time, MIN_SAMPLE_INTERVAL_MS);
	live.velocity = live.velocity * VELOCITY_MEMORY + speed * (1 - VELOCITY_MEMORY);
	live.time = time;
	const target = usePressure ? pressed : Math.max(maxWidth / (live.velocity + 1), minWidth);
	live.size += (target - live.size) * WIDTH_EASING;
	live.points.push([round(sx), round(sy), round(live.size)]);
}

/** A fast pen reports several samples per frame; the coalesced list keeps curves round. Not every engine has it. */
function readCoalescedSamples(event: PointerEvent): PointerEvent[] {
	try {
		const samples = event.getCoalescedEvents();
		return samples.length > 0 ? samples : [event];
	} catch {
		return [event];
	}
}

function toPointerType(pointerType: string): SignaturePadPointerType {
	const parsed = SignaturePadPointerTypeSchema.safeParse(pointerType);
	return parsed.success ? parsed.data : "mouse";
}

interface StrokePathProps {
	readonly stroke: SignaturePadStroke;
}

const StrokePath = React.memo(function StrokePath({ stroke }: StrokePathProps): React.JSX.Element {
	return <path data-slot="signature-pad-stroke" d={getSignaturePadStrokePath(stroke)} fill={stroke.color ?? "currentColor"} />;
});

interface KeyedStroke {
	readonly key: string;
	readonly stroke: SignaturePadStroke;
}

/** Stable React keys from stroke content (start point and length), numbered when two strokes collide. */
function keyStrokes(strokes: readonly SignaturePadStroke[]): KeyedStroke[] {
	const seen = new Map<string, number>();
	return strokes.map((stroke): KeyedStroke => {
		const base = `${stroke.points.at(0)?.join(",") ?? ""}:${String(stroke.points.length)}`;
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return { key: `${base}#${String(count)}`, stroke };
	});
}

const SHORTCUT_LETTER = /^[a-z]$/;
const KEY_CODE_PREFIX = /^Key/;

export interface SignaturePadAreaProps extends React.ComponentPropsWithoutRef<"div">, Omit<VariantProps<typeof signaturePadAreaVariants>, "state"> {}

interface AreaLatest {
	readonly api: SignaturePadApi;
	readonly config: SignaturePadConfig;
	readonly onPointerDown: React.PointerEventHandler<HTMLDivElement> | undefined;
	readonly onPointerMove: React.PointerEventHandler<HTMLDivElement> | undefined;
	readonly onPointerUp: React.PointerEventHandler<HTMLDivElement> | undefined;
	readonly onPointerCancel: React.PointerEventHandler<HTMLDivElement> | undefined;
	readonly onLostPointerCapture: React.PointerEventHandler<HTMLDivElement> | undefined;
	readonly onKeyDown: React.KeyboardEventHandler<HTMLDivElement> | undefined;
}

/**
 * The drawing surface. Children are overlays (a guide, a placeholder, pinned
 * controls) and must be `pointer-events-none` unless they are controls: a
 * stroke only starts on the area itself, never on something inside it.
 */
const SignaturePadArea = React.forwardRef<HTMLDivElement, SignaturePadAreaProps>(function SignaturePadArea(
	{
		variant = "default",
		className,
		children,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onLostPointerCapture,
		onKeyDown,
		"aria-describedby": describedBy,
		"aria-invalid": ariaInvalid,
		...props
	},
	ref,
): React.JSX.Element {
	const api = useSignaturePad();
	const config = useSignaturePadConfig("SignaturePadArea");
	const { labels } = config;
	const liveRef = React.useRef<LiveStroke | null>(null);
	const pathRef = React.useRef<SVGPathElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const frameRef = React.useRef(0);
	const latestRef = React.useRef<AreaLatest>({ api, config, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onKeyDown });

	React.useLayoutEffect((): void => {
		latestRef.current = { api, config, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onKeyDown };
	});

	/* Set imperatively: a PNG needs a canvas, which only exists in the browser,
	   and a controlled `value` would then differ between server and client. */
	React.useEffect((): void => {
		if (inputRef.current !== null) {
			inputRef.current.value = serializeSignaturePad(api.strokes, config.format);
		}
	}, [api.strokes, config.format, config.name]);

	/* Listens on the input's own root (the document, or a shadow root) and asks
	   for its form at reset time, so a `form` attribute or an owner that
	   changes later is still honoured. The restore waits a task, like a native
	   reset's default action, because any listener may still cancel it. */
	React.useEffect((): (() => void) | undefined => {
		const root = inputRef.current?.getRootNode();
		if (root === undefined) {
			return undefined;
		}
		let pending = 0;
		const onReset = (event: Event): void => {
			if (event.target !== inputRef.current?.form) {
				return;
			}
			pending = window.setTimeout((): void => {
				if (!event.defaultPrevented) {
					latestRef.current.config.resetToDefault();
				}
			});
		};
		root.addEventListener("reset", onReset, true);
		return (): void => {
			root.removeEventListener("reset", onReset, true);
			window.clearTimeout(pending);
		};
	}, [config.name]);

	React.useEffect((): (() => void) => {
		return (): void => {
			cancelAnimationFrame(frameRef.current);
		};
	}, []);

	const paint = React.useCallback((): void => {
		frameRef.current = 0;
		const live = liveRef.current;
		pathRef.current?.setAttribute("d", live === null ? "" : getSignaturePadStrokePath({ points: live.points }));
	}, []);

	const schedulePaint = React.useCallback((): void => {
		if (frameRef.current === 0) {
			frameRef.current = requestAnimationFrame(paint);
		}
	}, [paint]);

	/** `commit: false` discards: a pointercancel is the platform taking the pointer back, often a rejected palm. */
	const finish = React.useCallback((pointerId: number, commitStroke: boolean): void => {
		const live = liveRef.current;
		if (live?.pointerId !== pointerId) {
			return;
		}
		const { config: latestConfig } = latestRef.current;
		liveRef.current = null;
		cancelAnimationFrame(frameRef.current);
		frameRef.current = 0;
		/* Cleared in the same discrete event that commits the stroke, so React
		   paints the committed path in this frame and the ink never blinks. */
		pathRef.current?.setAttribute("d", "");
		latestConfig.setDrawing(false);
		if (!commitStroke) {
			return;
		}
		const last = live.points.at(-1);
		if (last !== undefined) {
			const [lastX, lastY] = last;
			if (Math.hypot(live.rawX - lastX, live.rawY - lastY) >= MIN_TAIL_DISTANCE) {
				live.points.push([round(live.rawX), round(live.rawY), round(live.size)]);
			}
		}
		latestConfig.commitStroke(latestConfig.color === undefined ? { points: live.points } : { points: live.points, color: latestConfig.color });
	}, []);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			const { config: latestConfig, onPointerDown: consumerHandler } = latestRef.current;
			consumerHandler?.(event);
			const area = event.currentTarget;
			const pointerType = toPointerType(event.pointerType);
			if (
				event.defaultPrevented ||
				!latestConfig.interactive ||
				event.target !== area ||
				!event.isPrimary ||
				(pointerType === "mouse" && event.button !== PRIMARY_MOUSE_BUTTON) ||
				(latestConfig.pointerTypes !== undefined && !latestConfig.pointerTypes.includes(pointerType))
			) {
				return;
			}
			/* A pen landing mid-stroke means the touch stroke was a resting palm. */
			const current = liveRef.current;
			if (current !== null) {
				if (current.pointerType !== "touch" || pointerType !== "pen") {
					return;
				}
				liveRef.current = null;
			}
			/* No preventDefault: the native mousedown focuses the area without
			   `:focus-visible`. Touch scrolling and text selection are already off
			   through `touch-none` and `select-none`. */
			try {
				area.setPointerCapture(event.pointerId);
			} catch {
				/* Only a pointer that is no longer active refuses capture. */
			}
			const rect = area.getBoundingClientRect();
			const next: LiveStroke = {
				pointerId: event.pointerId,
				pointerType,
				points: [],
				/* The ink layer starts inside the border, and a transformed ancestor
				   (a zooming dialog) scales the rect but not the coordinate space. */
				left: rect.left + area.clientLeft * (rect.width / area.offsetWidth || 1),
				top: rect.top + area.clientTop * (rect.height / area.offsetHeight || 1),
				scaleX: rect.width === 0 ? 1 : area.offsetWidth / rect.width || 1,
				scaleY: rect.height === 0 ? 1 : area.offsetHeight / rect.height || 1,
				time: event.timeStamp,
				velocity: 0,
				size: 0,
				rawX: 0,
				rawY: 0,
			};
			liveRef.current = next;
			addSample(next, latestConfig, event.clientX, event.clientY, event.pressure, event.timeStamp);
			schedulePaint();
			latestConfig.setDrawing(true);
			latestConfig.onStrokeStart?.({ pointerType });
		},
		[schedulePaint],
	);

	const handlePointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			const { config: latestConfig, onPointerMove: consumerHandler } = latestRef.current;
			consumerHandler?.(event);
			const live = liveRef.current;
			if (live?.pointerId !== event.pointerId) {
				return;
			}
			for (const sample of readCoalescedSamples(event.nativeEvent)) {
				addSample(live, latestConfig, sample.clientX, sample.clientY, sample.pressure, sample.timeStamp);
			}
			schedulePaint();
		},
		[schedulePaint],
	);

	const handlePointerUp = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			latestRef.current.onPointerUp?.(event);
			finish(event.pointerId, true);
		},
		[finish],
	);

	const handlePointerCancel = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			latestRef.current.onPointerCancel?.(event);
			finish(event.pointerId, false);
		},
		[finish],
	);

	const handleLostPointerCapture = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			latestRef.current.onLostPointerCapture?.(event);
			finish(event.pointerId, true);
		},
		[finish],
	);

	/* ⌘Z undoes, ⌘⇧Z / ⌘Y redo, on the area or on any control pinned in it. */
	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
		latestRef.current.onKeyDown?.(event);
		const { api: current, config: latestConfig } = latestRef.current;
		if (event.defaultPrevented || !latestConfig.interactive || !(event.metaKey || event.ctrlKey) || event.altKey) {
			return;
		}
		/* The physical key when the layout types no Latin letter (Cyrillic,
			   Greek, Hebrew), so the shortcut survives a layout switch. */
		const typed = event.key.toLowerCase();
		const key = SHORTCUT_LETTER.test(typed) ? typed : event.code.replace(KEY_CODE_PREFIX, "").toLowerCase();
		/* Pressed on a pinned control, the action may disable that control
			   (Undo at the start of history), and focus would fall to <body>;
			   it moves to the area instead. */
		const fromControl = event.target !== event.currentTarget;
		if (key === "z" && !event.shiftKey && current.canUndo) {
			event.preventDefault();
			current.undo();
			if (fromControl) {
				current.focus();
			}
		} else if ((key === "y" || (key === "z" && event.shiftKey)) && current.canRedo) {
			event.preventDefault();
			current.redo();
			if (fromControl) {
				current.focus();
			}
		}
	}, []);

	/* A failed `required` check focuses the hidden input; hand that to the pad. */
	const handleInputFocus = React.useCallback((): void => {
		latestRef.current.api.focus();
	}, []);

	const setArea = React.useCallback((node: HTMLDivElement | null): void => {
		latestRef.current.config.setArea(node);
	}, []);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLDivElement> => mergeRefs(setArea, ref), [setArea, ref]);

	const keyedStrokes = React.useMemo((): KeyedStroke[] => keyStrokes(api.strokes), [api.strokes]);
	const labelled = props["aria-label"] ?? props["aria-labelledby"];
	const statusId = React.useId();
	const state = resolveFieldState({ disabled: api.disabled, ariaInvalid });
	const status = api.isEmpty ? labels.empty : labels.signed;
	return (
		<div
			ref={mergedRef}
			role="application"
			aria-roledescription={labels.roleDescription}
			aria-label={labelled === undefined ? labels.area : undefined}
			aria-disabled={api.disabled ? true : undefined}
			aria-invalid={ariaInvalid}
			aria-describedby={describedBy === undefined ? statusId : `${describedBy} ${statusId}`}
			tabIndex={config.interactive ? 0 : -1}
			data-slot="signature-pad-area"
			data-variant={variant}
			data-empty={api.isEmpty ? true : undefined}
			data-drawing={api.isDrawing ? true : undefined}
			data-disabled={api.disabled ? true : undefined}
			data-readonly={api.readOnly ? true : undefined}
			data-invalid={state === "error" ? true : undefined}
			className={cn(signaturePadAreaVariants({ variant, state }), className)}
			{...props}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onLostPointerCapture={handleLostPointerCapture}
			onKeyDown={handleKeyDown}>
			{children}
			{/* The ink is invisible to assistive tech, so its state is spoken here. */}
			<span id={statusId} className="sr-only">
				{api.readOnly ? labels.readOnlyStatus(status) : status}
			</span>
			<svg data-slot="signature-pad-canvas" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
				{keyedStrokes.map(({ key, stroke }): React.JSX.Element => (
					<StrokePath key={key} stroke={stroke} />
				))}
				<path ref={pathRef} fill={config.color ?? "currentColor"} />
			</svg>
			{config.name === undefined ? null : (
				<input
					ref={inputRef}
					type="text"
					name={config.name}
					form={config.form}
					required={config.required}
					disabled={api.disabled}
					defaultValue=""
					tabIndex={-1}
					aria-hidden="true"
					onFocus={handleInputFocus}
					className="pointer-events-none absolute bottom-0 left-1/2 size-px opacity-0"
				/>
			)}
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Overlays                                  */
/* -------------------------------------------------------------------------- */

/** A dashed signing line with a cross at its start. Replace the cross with `children`. */
const SignaturePadGuide = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(function SignaturePadGuide(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="signature-pad-guide"
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-x-6 bottom-8 flex items-end gap-2 border-b border-dashed border-muted-foreground/40 pb-1.5 text-xs text-muted-foreground",
				className,
			)}
			{...props}>
			{children ?? (
				<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3">
					<path d="M2 2l8 8M10 2l-8 8" />
				</svg>
			)}
		</div>
	);
});

/** Shown only while the pad is empty and nobody is drawing. Defaults to the `placeholder` label. */
const SignaturePadPlaceholder = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(function SignaturePadPlaceholder(
	{ className, children, ...props },
	ref,
): React.JSX.Element | null {
	const { isEmpty, isDrawing } = useSignaturePad();
	const { labels } = useSignaturePadConfig("SignaturePadPlaceholder");
	if (!isEmpty || isDrawing) {
		return null;
	}
	return (
		<div
			ref={ref}
			data-slot="signature-pad-placeholder"
			aria-hidden="true"
			className={cn("pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground", className)}
			{...props}>
			{children ?? labels.placeholder}
		</div>
	);
});

export type SignaturePadControlsPosition = "top-start" | "top-end" | "bottom-start" | "bottom-end";

const CONTROLS_POSITION_CLASS: Readonly<Record<SignaturePadControlsPosition, string>> = {
	"top-start": "start-2 top-2",
	"top-end": "end-2 top-2",
	"bottom-start": "start-2 bottom-2",
	"bottom-end": "end-2 bottom-2",
};

export interface SignaturePadControlsProps extends React.ComponentPropsWithoutRef<"div"> {
	readonly position?: SignaturePadControlsPosition | undefined;
}

/**
 * Pins a group of controls to a corner of the area, above the ink. Top-end by
 * default: signatures run along the bottom, where `bottom-end` sat on the
 * guide line and under the last letters.
 */
const SignaturePadControls = React.forwardRef<HTMLDivElement, SignaturePadControlsProps>(function SignaturePadControls(
	{ position = "top-end", className, ...props },
	ref,
): React.JSX.Element {
	const { labels } = useSignaturePadConfig("SignaturePadControls");
	return (
		<div
			ref={ref}
			role="group"
			aria-label={labels.controls}
			data-slot="signature-pad-controls"
			data-position={position}
			className={cn("absolute z-10 flex items-center gap-1", CONTROLS_POSITION_CLASS[position], className)}
			{...props}
		/>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Controls                                  */
/* -------------------------------------------------------------------------- */

export type SignaturePadControlProps = React.ComponentPropsWithoutRef<typeof Button>;

type ButtonClickEvent = Parameters<NonNullable<SignaturePadControlProps["onClick"]>>[0];

/*
 * Each control defaults to an icon button and takes text as `children`. A
 * control that disables itself would strand keyboard focus on `<body>`, so
 * each one hands focus to the area when its own action empties it.
 */
const SignaturePadClear = React.forwardRef<HTMLElement, SignaturePadControlProps>(function SignaturePadClear(
	{ children, onClick, disabled, variant = "outline", size = "icon-sm", ...props },
	ref,
): React.JSX.Element {
	const api = useSignaturePad();
	const { labels } = useSignaturePadConfig("SignaturePadClear");
	const handleClick = React.useCallback(
		(event: ButtonClickEvent): void => {
			onClick?.(event);
			if (event.defaultPrevented) {
				return;
			}
			api.clear();
			api.focus();
		},
		[api, onClick],
	);
	return (
		<Button
			ref={ref}
			type="button"
			data-slot="signature-pad-clear"
			aria-label={children === undefined ? labels.clear : undefined}
			variant={variant}
			size={size}
			{...props}
			disabled={disabled === true || api.isEmpty || api.disabled || api.readOnly}
			onClick={handleClick}>
			{children ?? <BrushCleaningIcon aria-hidden="true" />}
		</Button>
	);
});

const SignaturePadUndo = React.forwardRef<HTMLElement, SignaturePadControlProps>(function SignaturePadUndo(
	{ children, onClick, disabled, variant = "outline", size = "icon-sm", ...props },
	ref,
): React.JSX.Element {
	const api = useSignaturePad();
	const { labels, undoDepth } = useSignaturePadConfig("SignaturePadUndo");
	const handleClick = React.useCallback(
		(event: ButtonClickEvent): void => {
			onClick?.(event);
			if (event.defaultPrevented) {
				return;
			}
			api.undo();
			if (undoDepth === 1) {
				api.focus();
			}
		},
		[api, onClick, undoDepth],
	);
	return (
		<Button
			ref={ref}
			type="button"
			data-slot="signature-pad-undo"
			aria-label={children === undefined ? labels.undo : undefined}
			variant={variant}
			size={size}
			{...props}
			disabled={disabled === true || !api.canUndo || api.disabled || api.readOnly}
			onClick={handleClick}>
			{children ?? <Undo2Icon aria-hidden="true" />}
		</Button>
	);
});

const SignaturePadRedo = React.forwardRef<HTMLElement, SignaturePadControlProps>(function SignaturePadRedo(
	{ children, onClick, disabled, variant = "outline", size = "icon-sm", ...props },
	ref,
): React.JSX.Element {
	const api = useSignaturePad();
	const { labels, redoDepth } = useSignaturePadConfig("SignaturePadRedo");
	const handleClick = React.useCallback(
		(event: ButtonClickEvent): void => {
			onClick?.(event);
			if (event.defaultPrevented) {
				return;
			}
			api.redo();
			if (redoDepth === 1) {
				api.focus();
			}
		},
		[api, onClick, redoDepth],
	);
	return (
		<Button
			ref={ref}
			type="button"
			data-slot="signature-pad-redo"
			aria-label={children === undefined ? labels.redo : undefined}
			variant={variant}
			size={size}
			{...props}
			disabled={disabled === true || !api.canRedo || api.disabled || api.readOnly}
			onClick={handleClick}>
			{children ?? <Redo2Icon aria-hidden="true" />}
		</Button>
	);
});

export interface SignaturePadSaveProps extends SignaturePadControlProps {
	readonly format?: SignaturePadFormat | undefined;
	readonly options?: SignaturePadExportOptions | undefined;
	readonly onSave?: ((value: string, strokes: SignaturePadStroke[]) => void) | undefined;
}

/** Serializes the pad and hands the result to `onSave`. Disabled while the pad is empty. */
const SignaturePadSave = React.forwardRef<HTMLElement, SignaturePadSaveProps>(function SignaturePadSave(
	{ format = "png", options, onSave, children, onClick, disabled, variant = "outline", size = "icon-sm", ...props },
	ref,
): React.JSX.Element {
	const api = useSignaturePad();
	const { labels } = useSignaturePadConfig("SignaturePadSave");
	const handleClick = React.useCallback(
		(event: ButtonClickEvent): void => {
			onClick?.(event);
			if (event.defaultPrevented) {
				return;
			}
			onSave?.(api.serialize(format, options), api.strokes);
		},
		[api, format, onClick, onSave, options],
	);
	return (
		<Button
			ref={ref}
			type="button"
			data-slot="signature-pad-save"
			aria-label={children === undefined ? labels.save : undefined}
			variant={variant}
			size={size}
			{...props}
			disabled={disabled === true || api.isEmpty || api.disabled}
			onClick={handleClick}>
			{children ?? <SaveIcon aria-hidden="true" />}
		</Button>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Preview                                  */
/* -------------------------------------------------------------------------- */

export interface SignaturePadPreviewProps extends Omit<React.ComponentPropsWithoutRef<"svg">, "color"> {
	readonly strokes: SignaturePadStroke[];
	readonly padding?: number | undefined;
	readonly color?: string | undefined;
	/** Per-usage overrides of the `signaturePad` copy (its accessible name is `preview`). */
	readonly labels?: UiKitLabelsOverride<"signaturePad"> | undefined;
}

/**
 * Saved strokes as an inline SVG cropped to the ink, for lists, receipts and
 * documents. Needs no `SignaturePad` around it, and scales with CSS while the
 * ink keeps following `currentColor`. Renders nothing for an empty signature.
 */
const SignaturePadPreview = React.forwardRef<SVGSVGElement, SignaturePadPreviewProps>(function SignaturePadPreview(
	{ strokes, padding = DEFAULT_PREVIEW_PADDING, color, labels: labelsOverride, className, ...props },
	ref,
): React.JSX.Element | null {
	const labels = useUiKitLabels("signaturePad", labelsOverride);
	const keyedStrokes = React.useMemo((): KeyedStroke[] => keyStrokes(strokes), [strokes]);
	if (strokes.length === 0) {
		return null;
	}
	const { x, y, width, height } = resolveFrame(strokes, { padding });
	return (
		<svg
			ref={ref}
			data-slot="signature-pad-preview"
			role="img"
			aria-label={labels.preview}
			viewBox={`${String(x)} ${String(y)} ${String(width)} ${String(height)}`}
			width={width}
			height={height}
			className={cn("h-auto max-w-full text-foreground", className)}
			{...props}>
			{keyedStrokes.map(({ key, stroke }): React.JSX.Element => (
				<path key={key} d={getSignaturePadStrokePath(stroke)} fill={stroke.color ?? color ?? "currentColor"} />
			))}
		</svg>
	);
});

export {
	SignaturePad,
	SignaturePadArea,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadControls,
	SignaturePadClear,
	SignaturePadUndo,
	SignaturePadRedo,
	SignaturePadSave,
	SignaturePadPreview,
	signaturePadAreaVariants,
	useSignaturePad,
	getSignaturePadStrokePath,
	getSignaturePadBounds,
	serializeSignaturePad,
	signaturePadToSVG,
	signaturePadToDataURL,
	signaturePadToBlob,
};
