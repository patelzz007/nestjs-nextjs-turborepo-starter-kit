"use client";

import { colorToCss, formatColor } from "@workspace/ui/lib/color/color-format";
import type { ColorDescription } from "@workspace/ui/lib/color/color-name";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import {
	channelRange,
	clamp,
	formatFixed,
	readChannel,
	withChannel,
	type ColorPickerChannel,
	type ColorPickerColor,
	type ColorPickerColorSpace,
	type ColorPickerFormat,
} from "@workspace/ui/lib/color/color-space";
import type { FieldState } from "@workspace/ui/lib/form/field-state";
import { cva } from "class-variance-authority";
import * as React from "react";

/**
 * Every user-facing string the colour picker renders or announces — the
 * `colorPicker` family of `UiKitLabels`. A picker's `i18n.labels` overrides
 * some of them for one usage.
 */
export interface ColorPickerLabels {
	/** Trigger and input text while there is no value. */
	readonly placeholder: string;
	/** Names the popup and an inline panel. */
	readonly panelLabel: string;
	/** The swatch button in `ColorPickerInput`. */
	readonly openPicker: string;
	/** The saturation and brightness area. */
	readonly area: string;
	readonly hue: string;
	readonly saturation: string;
	readonly brightness: string;
	readonly lightness: string;
	readonly chroma: string;
	readonly red: string;
	readonly green: string;
	readonly blue: string;
	readonly alpha: string;
	readonly hex: string;
	/** The format menu's name. */
	readonly format: string;
	readonly eyeDropper: string;
	readonly copy: string;
	readonly copied: string;
	readonly clear: string;
	readonly swatches: string;
	/** Display names of the formats ("HEX", "OKLCH"). */
	readonly formatNames: Readonly<Record<ColorPickerFormat, string>>;
	/** The format menu trigger's accessible name, given the shown format's display name. */
	readonly formatTrigger: (formatName: string) => string;
	/** The area's value text, given saturation and brightness (0–100, rounded) and the colour's name. */
	readonly areaValueText: (saturation: number, brightness: number, colorName: string) => string;
	/** A hue slider's value text, given the degrees (rounded) and the colour's name. */
	readonly hueValueText: (degrees: number, colorName: string) => string;
	/** Words for a colour, given its language-neutral description ("dark vibrant blue"). */
	readonly colorName: (description: ColorDescription) => string;
}

export interface ColorPickerFunctions {
	/** Names a colour for screen readers, in the area, the sliders and unlabelled swatches. */
	readonly getColorName: (color: ColorPickerColor) => string;
}

export interface ColorPickerI18nConfig {
	readonly labels: ColorPickerLabels;
	readonly functions: ColorPickerFunctions;
}

/** One level deeper than `Partial`, so a single label can be overridden. */
export interface ColorPickerI18nOverrides {
	readonly labels?: Partial<ColorPickerLabels>;
	readonly functions?: Partial<ColorPickerFunctions>;
}

export interface ColorPickerContextValue {
	readonly id: string;
	readonly value: string | null;
	/** The colour written in `format` for display, hex in capitals, or `null`. */
	readonly text: string | null;
	/** The committed colour, or `null` while empty. */
	readonly color: ColorPickerColor | null;
	/** What the controls show: the colour, or white while empty. */
	readonly display: ColorPickerColor;
	readonly format: ColorPickerFormat;
	readonly alpha: boolean;
	readonly i18n: ColorPickerI18nConfig;
	readonly disabled: boolean;
	readonly readOnly: boolean;
	readonly editable: boolean;
	readonly invalid: boolean;
	readonly required: boolean;
	/** The CVA `state` every part paints with. */
	readonly state: FieldState;
	readonly label: string | undefined;
	readonly labelledBy: string | undefined;
	readonly describedBy: string | undefined;
	readonly swatches: readonly ColorPickerSwatchInput[] | undefined;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	/** The latest colour, for handlers that fire before the next render. */
	readonly getColor: () => ColorPickerColor;
	/** Changes the value mid-interaction; `onValueCommit` waits for the end. */
	readonly emit: (color: ColorPickerColor | null) => void;
	readonly startInteraction: () => void;
	readonly endInteraction: () => void;
	/** A whole interaction in one: emits and commits. */
	readonly change: (color: ColorPickerColor | null) => void;
	/** The trigger or the input: where a failed `required` check sends focus, and where the root's ref lands. */
	readonly registerFocusTarget: (node: HTMLElement | null) => void;
	/** The format on screen: the fields' when they are shown, else `format`. */
	readonly shownFormat: ColorPickerFormat;
	readonly setFieldsFormat: (format: ColorPickerFormat | null) => void;
	/** Writes the value to the clipboard, in the format on screen by default. */
	readonly copy: (format?: ColorPickerFormat) => void;
	/** The format just copied, for a moment, so its button can confirm. */
	readonly copied: ColorPickerFormat | null;
}

/** A preset colour: a CSS colour string, or one with a label read out instead of its generated name. */
export type ColorPickerSwatchInput = string | { readonly value: string; readonly label?: string };

export const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null);

/** "inline" unless a part renders inside `ColorPickerContent`. */
export const ColorPickerSurfaceContext = React.createContext<"inline" | "popup">("inline");

export function useColorPickerContext(part: string): ColorPickerContextValue {
	const context = React.useContext(ColorPickerContext);
	if (context === null) {
		throw new Error(`${part} must be used within a ColorPicker`);
	}
	return context;
}

export interface ColorPickerApi {
	/** The value as emitted, or `null`. */
	readonly value: string | null;
	readonly color: ColorPickerColor | null;
	readonly format: ColorPickerFormat;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	/** Commits any colour `parseColor` reads; `null` or `""` clears, anything else is ignored. */
	readonly setValue: (value: string | null) => void;
	readonly clear: () => void;
}

/** The picker's state and actions, inside a `ColorPicker`. */
export function useColorPicker(): ColorPickerApi {
	const context = useColorPickerContext("useColorPicker");
	const { change } = context;
	const setValue = React.useCallback(
		(next: string | null): void => {
			if (next === null || next.length === 0) {
				change(null);
				return;
			}
			const parsed = parseColor(next);
			if (parsed !== null) {
				change(parsed);
			}
		},
		[change],
	);
	const clear = React.useCallback((): void => {
		change(null);
	}, [change]);
	return { value: context.value, color: context.color, format: context.format, open: context.open, setOpen: context.setOpen, setValue, clear };
}

/* -------------------------------- Shared styling -------------------------------- */

/** What the controls show while the value is empty: white, hue 0. */
export const EMPTY_COLOR: ColorPickerColor = { space: "hsv", channels: [0, 0, 100], alpha: 1 };

/** The transparency grid behind translucent colours, in theme tokens. */
export const CHECKER_BACKGROUND = "repeating-conic-gradient(var(--color-muted) 0 25%, var(--color-background) 0 50%) 50% / 8px 8px";

/** A slash through an empty swatch, the convention for "no colour". */
const EMPTY_SWATCH_BACKGROUND =
	"linear-gradient(to top right, transparent calc(50% - 0.75px), var(--color-destructive) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px))";

/** A swatch's paint: the colour over the checker when translucent, the slash when empty. */
export function swatchBackground(color: ColorPickerColor | null): string {
	if (color === null) {
		return EMPTY_SWATCH_BACKGROUND;
	}
	const css = colorToCss(color);
	return color.alpha < 1 ? `linear-gradient(${css}, ${css}), ${CHECKER_BACKGROUND}` : css;
}

/**
 * The draggable controls (area, sliders, wheel): a `state` axis dims a
 * disabled control. The thumb's keyboard ring is drawn while the control has focus.
 */
export const colorPickerControlVariants = cva(
	"group/color-picker-control relative outline-none select-none [--color-picker-thumb-size:calc(var(--spacing)*4)] data-dragging:cursor-grabbing",
	{
		variants: {
			state: {
				default: "",
				loading: "pointer-events-none opacity-80",
				disabled: "pointer-events-none opacity-50",
				error: "",
			},
		},
		defaultVariants: { state: "default" },
	},
);

/**
 * A thumb sits on the user's colour, whatever it is, so it is white with a
 * dark hairline — like the image cropper's grid, it is drawn over content,
 * not chrome. The focus ring is the theme's.
 */
export const COLOR_PICKER_THUMB_CLASS =
	"pointer-events-none absolute size-(--color-picker-thumb-size) -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_color-mix(in_oklch,var(--scrim)_12%,transparent),0_1px_3px_color-mix(in_oklch,var(--scrim)_30%,transparent)] ring-ring/50 transition-[box-shadow] group-focus-visible/color-picker-control:ring-4 forced-colors:outline-2 forced-colors:outline-solid";

/** A hairline inside the edge, so the white corner of the area and the light end of a track stay visible. */
export const COLOR_PICKER_EDGE_CLASS = "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/10";

/** A point along a slider's travel, inset by half a thumb at each end. */
export function sliderTravel(fraction: number): string {
	return `calc(var(--color-picker-thumb-size) / 2 + (100% - var(--color-picker-thumb-size)) * ${String(fraction)})`;
}

/* -------------------------------- Shared behaviour -------------------------------- */

const COPY_SHORTCUT_KEY = "c";

/**
 * Cmd+C or Ctrl+C on a control with nothing selected copies the value in the
 * format on screen. A selection in a field keeps the browser's own copy.
 */
export function copyOnShortcut(event: React.KeyboardEvent<HTMLElement>, context: ColorPickerContextValue): boolean {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== COPY_SHORTCUT_KEY || context.color === null) {
		return false;
	}
	const target = event.target;
	const hasSelection =
		target instanceof HTMLInputElement ? target.selectionStart !== target.selectionEnd : (event.currentTarget.ownerDocument.getSelection()?.toString() ?? "").length > 0;
	if (hasSelection) {
		return false;
	}
	event.preventDefault();
	context.copy();
	return true;
}

/**
 * While a field holds an edit, Escape puts the value back and stops there.
 * The popover closes on a document listener, which an element handler runs
 * too late to stop, so this one listens on the window first.
 */
export function useEscapeRevert(field: React.RefObject<HTMLElement | null>, editing: boolean, revert: () => void): void {
	const revertRef = React.useRef(revert);
	React.useLayoutEffect((): void => {
		revertRef.current = revert;
	});
	React.useEffect((): (() => void) | undefined => {
		const view = field.current?.ownerDocument.defaultView;
		if (!editing || view === null || view === undefined) {
			return undefined;
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== "Escape" || event.target !== field.current) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			revertRef.current();
		};
		view.addEventListener("keydown", handleKeyDown, true);
		return (): void => {
			view.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [editing, field]);
}

export interface PointerRatio {
	readonly x: number;
	readonly y: number;
}

/** Where the pointer sits, 0 to 1 each way, over a travel `inset` pixels shorter than the element. */
export function pointerRatio(event: React.PointerEvent<HTMLElement>, element: HTMLElement, inset = 0): PointerRatio {
	const rect = element.getBoundingClientRect();
	const ratio = (offset: number, size: number): number => (size > inset ? clamp((offset - inset / 2) / (size - inset), 0, 1) : 0);
	return { x: ratio(event.clientX - rect.left, rect.width), y: ratio(event.clientY - rect.top, rect.height) };
}

export interface DragHandlers {
	readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
	readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
	readonly onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
	readonly onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}

export interface DragState {
	readonly dragging: boolean;
	readonly handlers: DragHandlers;
}

const PRIMARY_POINTER_BUTTON = 0;

/**
 * Pointer drags shared by the area, the sliders and the wheel. The pointer is
 * captured, so a drag carries on outside the control.
 */
export function useColorPickerDrag(context: ColorPickerContextValue, update: (event: React.PointerEvent<HTMLElement>, element: HTMLElement) => void): DragState {
	const pointer = React.useRef<number | null>(null);
	const [dragging, setDragging] = React.useState(false);
	const updateRef = React.useRef(update);
	React.useLayoutEffect((): void => {
		updateRef.current = update;
	});
	const { editable, startInteraction, endInteraction } = context;
	const end = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			if (pointer.current !== event.pointerId) {
				return;
			}
			pointer.current = null;
			setDragging(false);
			endInteraction();
		},
		[endInteraction],
	);
	const onPointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			if (event.button !== PRIMARY_POINTER_BUTTON || !editable) {
				return;
			}
			pointer.current = event.pointerId;
			event.currentTarget.setPointerCapture(event.pointerId);
			setDragging(true);
			startInteraction();
			updateRef.current(event, event.currentTarget);
		},
		[editable, startInteraction],
	);
	const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>): void => {
		if (pointer.current === event.pointerId) {
			updateRef.current(event, event.currentTarget);
		}
	}, []);
	const handlers = React.useMemo((): DragHandlers => ({ onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }), [end, onPointerDown, onPointerMove]);
	return { dragging, handlers };
}

const PAGE_STEP_MULTIPLIER = 10;

/** Arrows move a step, ten with Shift; Page keys ten; Home and End the ends. `null` for any other key. */
export function keyDelta(event: React.KeyboardEvent, step: number): number | null {
	const size = event.shiftKey ? step * PAGE_STEP_MULTIPLIER : step;
	switch (event.key) {
		case "ArrowUp":
		case "ArrowRight":
			return size;
		case "ArrowDown":
		case "ArrowLeft":
			return -size;
		case "PageUp":
			return step * PAGE_STEP_MULTIPLIER;
		case "PageDown":
			return -step * PAGE_STEP_MULTIPLIER;
		case "Home":
			return -Infinity;
		case "End":
			return Infinity;
		default:
			return null;
	}
}

const ALPHA_PERCENT_SCALE = 100;
const CHROMA_TEXT_DIGITS = 3;

/** Screen reader text for one channel: "210°, blue", "50%", "128". */
export function channelValueText(color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorPickerChannel, i18n: ColorPickerI18nConfig): string {
	const value = readChannel(color, space, channel);
	if (channel === "alpha") {
		return `${String(Math.round(value * ALPHA_PERCENT_SCALE))}%`;
	}
	if (channel === "chroma") {
		return formatFixed(value, CHROMA_TEXT_DIGITS);
	}
	if (channel === "hue") {
		return i18n.labels.hueValueText(Math.round(value), i18n.functions.getColorName(color));
	}
	return space === "rgb" ? String(Math.round(value)) : `${String(Math.round(value))}%`;
}

/** An OKLCH hue track keeps at least this chroma, so a grey still shows its hues. */
const HUE_TRACK_MIN_CHROMA = 0.12;
/** Samples along a track whose colours do not run straight in sRGB. */
const CURVED_TRACK_STOPS = 13;
const HSL_LIGHTNESS_TRACK_STOPS = 3;
const LINEAR_TRACK_STOPS = 2;
const FULL_HUE_SPECTRUM: ColorPickerColor = { space: "hsv", channels: [0, 100, 100], alpha: 1 };

function trackStopCount(space: ColorPickerColorSpace, channel: ColorPickerChannel): number {
	if (channel === "hue" || space === "oklch") {
		return CURVED_TRACK_STOPS;
	}
	return space === "hsl" && channel === "lightness" ? HSL_LIGHTNESS_TRACK_STOPS : LINEAR_TRACK_STOPS;
}

/**
 * The colours a track runs through: the full spectrum for hue, so a grey
 * still shows where it would go, and sampled stops elsewhere.
 */
export function trackStops(color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorPickerChannel): string[] {
	const opaque: ColorPickerColor = { ...color, alpha: 1 };
	if (channel === "alpha") {
		return ["transparent", colorToCss(opaque)];
	}
	let base = opaque;
	if (channel === "hue") {
		base = space === "oklch" ? withChannel(opaque, "oklch", "chroma", Math.max(readChannel(opaque, "oklch", "chroma"), HUE_TRACK_MIN_CHROMA)) : FULL_HUE_SPECTRUM;
	}
	const count = trackStopCount(space, channel);
	const { max } = channelRange(space, channel);
	const target = channel === "hue" && space !== "oklch" ? "hsv" : space;
	return Array.from({ length: count }, (_entry: undefined, index: number): string => formatColor(withChannel(base, target, channel, (max * index) / (count - 1)), "rgb"));
}
