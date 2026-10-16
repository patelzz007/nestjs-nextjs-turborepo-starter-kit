"use client";

import type { BaseUIEvent } from "@base-ui/react/types";
import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import {
	CHECKER_BACKGROUND,
	COLOR_PICKER_EDGE_CLASS,
	COLOR_PICKER_THUMB_CLASS,
	channelValueText,
	colorPickerControlVariants,
	copyOnShortcut,
	keyDelta,
	pointerRatio,
	sliderTravel,
	trackStops,
	useColorPickerContext,
	useColorPickerDrag,
} from "@workspace/ui/components/color-picker-context";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import {
	channelRange,
	clamp,
	HUE_MAX_DEGREES,
	PERCENT_MAX,
	radiansToDegrees,
	degreesToRadians,
	readChannel,
	resolveChannelSpace,
	snapToStep,
	toSpace,
	withChannel,
	wrapHue,
	type ColorPickerChannel,
	type ColorPickerColorSpace,
	type ColorPickerFormat,
} from "@workspace/ui/lib/color/color-space";
import { cn } from "@workspace/ui/lib/core/utils";
import { CheckIcon, CopyIcon, PipetteIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

/* -------------------------------- Area -------------------------------- */

/** Saturation runs to white across, brightness to black down: the colour model itself, so these are data, not chrome. */
const AREA_GRADIENTS = "linear-gradient(to top, rgb(0 0 0), transparent), linear-gradient(to right, rgb(255 255 255), transparent)";
const AREA_CLASS = "h-40 w-full touch-none rounded-sm forced-color-adjust-none";

export type ColorPickerAreaProps = Omit<React.ComponentProps<"div">, "ref">;

/**
 * The saturation and brightness square, at the current hue. A single slider
 * to assistive tech, whose value text names both channels and the colour.
 * Arrows move it, Shift by ten, Page keys move brightness.
 */
const ColorPickerArea = React.forwardRef<HTMLDivElement, ColorPickerAreaProps>(function ColorPickerArea({ className, style, onKeyDown, ...props }, ref): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerArea");
	const { labels, functions } = context.i18n;
	const [hue, saturation, brightness] = toSpace(context.display, "hsv");
	const { emit, getColor, startInteraction, endInteraction, editable } = context;
	const set = React.useCallback(
		(nextSaturation: number, nextBrightness: number): void => {
			const latest = getColor();
			const [latestHue] = toSpace(latest, "hsv");
			emit({ space: "hsv", channels: [latestHue, clamp(nextSaturation, 0, PERCENT_MAX), clamp(nextBrightness, 0, PERCENT_MAX)], alpha: latest.alpha });
		},
		[emit, getColor],
	);
	const { dragging, handlers } = useColorPickerDrag(context, (event: React.PointerEvent<HTMLElement>, element: HTMLElement): void => {
		const { x, y } = pointerRatio(event, element);
		set(x * PERCENT_MAX, (1 - y) * PERCENT_MAX);
	});
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || copyOnShortcut(event, context) || !editable) {
				return;
			}
			const delta = keyDelta(event, 1);
			if (delta === null) {
				return;
			}
			event.preventDefault();
			const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown" || event.key.startsWith("Page");
			startInteraction();
			/* Only the channel that moves is rounded to the step. */
			if (isVertical) {
				set(saturation, Math.round(brightness) + delta);
			} else {
				set(Math.round(saturation) + delta, brightness);
			}
			endInteraction();
		},
		[brightness, context, editable, endInteraction, onKeyDown, saturation, set, startInteraction],
	);
	const areaStyle = React.useMemo((): React.CSSProperties => ({ backgroundColor: `hsl(${String(hue)} 100% 50%)`, backgroundImage: AREA_GRADIENTS, ...style }), [hue, style]);
	const thumbStyle = React.useMemo((): React.CSSProperties => ({ left: `${String(saturation)}%`, top: `${String(PERCENT_MAX - brightness)}%` }), [brightness, saturation]);
	const colorName = functions.getColorName(context.display);

	return (
		<div
			ref={ref}
			id={`${context.id}-area`}
			role="slider"
			tabIndex={context.disabled ? -1 : 0}
			aria-label={labels.area}
			aria-valuemin={0}
			aria-valuemax={PERCENT_MAX}
			aria-valuenow={Math.round(saturation)}
			aria-valuetext={labels.areaValueText(Math.round(saturation), Math.round(brightness), colorName)}
			aria-disabled={context.disabled ? true : undefined}
			aria-readonly={context.readOnly ? true : undefined}
			dir="ltr"
			data-slot="color-picker-area"
			data-dragging={dragging ? "" : undefined}
			className={cn(colorPickerControlVariants({ state: context.state }), COLOR_PICKER_EDGE_CLASS, AREA_CLASS, className)}
			style={areaStyle}
			onKeyDown={handleKeyDown}
			{...handlers}
			{...props}>
			<div data-slot="color-picker-area-thumb" className={COLOR_PICKER_THUMB_CLASS} style={thumbStyle} />
		</div>
	);
});

/* -------------------------------- Slider -------------------------------- */

/*
 * A horizontal track fills its row and shrinks beside a sibling; a vertical
 * one never shrinks. Every colour surface opts out of forced colours, which
 * would paint over its gradient: the colour is the content.
 */
const SLIDER_CLASS =
	"rounded-full forced-color-adjust-none data-[orientation=horizontal]:h-3 data-[orientation=horizontal]:min-h-3 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-0 data-[orientation=horizontal]:touch-pan-y data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-3 data-[orientation=vertical]:shrink-0 data-[orientation=vertical]:touch-pan-x";

/** Chroma snaps finer than its keyboard step, so a drag lands between steps. */
const CHROMA_DRAG_PRECISION = 0.001;
const ALPHA_ARIA_SCALE = 100;
const ARIA_VALUE_DIGITS = 3;

export type ColorPickerSliderProps = Omit<React.ComponentProps<"div">, "children" | "ref"> & {
	readonly channel: ColorPickerChannel;
	/** The space the channel belongs to. Defaults to HSB for hue, saturation and brightness, HSL for lightness, OKLCH for chroma and RGB for red, green and blue. */
	readonly colorSpace?: ColorPickerColorSpace | undefined;
	readonly orientation?: "horizontal" | "vertical" | undefined;
};

/** One channel as a gradient track. Vertical tracks run bottom to top. */
const ColorPickerSlider = React.forwardRef<HTMLDivElement, ColorPickerSliderProps>(function ColorPickerSlider(
	{ channel, colorSpace, orientation = "horizontal", className, style, onKeyDown, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerSlider");
	const space = resolveChannelSpace(channel, colorSpace);
	const { max, step } = channelRange(space, channel);
	const precision = channel === "chroma" ? CHROMA_DRAG_PRECISION : step;
	const value = readChannel(context.display, space, channel);
	const isVertical = orientation === "vertical";
	const { emit, getColor, startInteraction, endInteraction, editable } = context;
	const set = React.useCallback(
		(next: number): void => {
			emit(withChannel(getColor(), space, channel, clamp(snapToStep(next, precision), 0, max)));
		},
		[channel, emit, getColor, max, precision, space],
	);
	const { dragging, handlers } = useColorPickerDrag(context, (event: React.PointerEvent<HTMLElement>, element: HTMLElement): void => {
		const thumb = element.lastElementChild;
		let inset = 0;
		if (thumb instanceof HTMLElement) {
			inset = isVertical ? thumb.offsetHeight : thumb.offsetWidth;
		}
		const { x, y } = pointerRatio(event, element, inset);
		set((isVertical ? 1 - y : x) * max);
	});
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || copyOnShortcut(event, context) || !editable) {
				return;
			}
			const delta = keyDelta(event, step);
			if (delta === null) {
				return;
			}
			event.preventDefault();
			startInteraction();
			set(snapToStep(value, step) + delta);
			endInteraction();
		},
		[context, editable, endInteraction, onKeyDown, set, startInteraction, step, value],
	);
	/* Stops follow the thumb's travel, so the colour under its centre is the value's own. */
	const colors = trackStops(context.display, space, channel);
	const stops = colors.map((stopColor: string, index: number): string => `${stopColor} ${sliderTravel(index / (colors.length - 1))}`);
	const gradient = `linear-gradient(${isVertical ? "to top" : "to right"}, ${stops.join(", ")})`;
	const fraction = clamp(value, 0, max) / max;
	const scale = channel === "alpha" ? ALPHA_ARIA_SCALE : 1;
	const trackStyle = React.useMemo(
		(): React.CSSProperties => ({ background: channel === "alpha" ? `${gradient}, ${CHECKER_BACKGROUND}` : gradient, ...style }),
		[channel, gradient, style],
	);
	const thumbStyle = React.useMemo(
		(): React.CSSProperties => (isVertical ? { left: "50%", top: sliderTravel(1 - fraction) } : { left: sliderTravel(fraction), top: "50%" }),
		[fraction, isVertical],
	);

	return (
		<div
			ref={ref}
			role="slider"
			tabIndex={context.disabled ? -1 : 0}
			aria-label={context.i18n.labels[channel]}
			aria-orientation={orientation}
			aria-valuemin={0}
			aria-valuemax={max * scale}
			aria-valuenow={Number((value * scale).toFixed(ARIA_VALUE_DIGITS))}
			aria-valuetext={channelValueText(context.display, space, channel, context.i18n)}
			aria-disabled={context.disabled ? true : undefined}
			aria-readonly={context.readOnly ? true : undefined}
			dir="ltr"
			data-slot="color-picker-slider"
			data-channel={channel}
			data-orientation={orientation}
			data-dragging={dragging ? "" : undefined}
			className={cn(colorPickerControlVariants({ state: context.state }), COLOR_PICKER_EDGE_CLASS, SLIDER_CLASS, className)}
			style={trackStyle}
			onKeyDown={handleKeyDown}
			{...handlers}
			{...props}>
			<div data-slot="color-picker-slider-thumb" className={COLOR_PICKER_THUMB_CLASS} style={thumbStyle} />
		</div>
	);
});

/* -------------------------------- Wheel -------------------------------- */

/** The hue spectrum, hue 0 at the top, increasing clockwise — colour data. */
const WHEEL_SPECTRUM = "conic-gradient(rgb(255 0 0), rgb(255 255 0), rgb(0 255 0), rgb(0 255 255), rgb(0 0 255), rgb(255 0 255), rgb(255 0 0))";
const WHEEL_RING_STYLE: React.CSSProperties = { backgroundImage: WHEEL_SPECTRUM };
/* The ring is a masked layer of its own, so the thumb and its focus ring are never masked with it. */
const WHEEL_RING_CLASS =
	"pointer-events-none absolute inset-0 rounded-full forced-color-adjust-none mask-[radial-gradient(farthest-side,transparent_calc(100%-var(--color-picker-wheel-thickness)),#000_calc(100%-var(--color-picker-wheel-thickness)+1px))]";
const WHEEL_HUE_KEY_MAX = 359;
/** Pixels of slack inside the ring's inner edge before a press counts as the hole. */
const WHEEL_HOLE_SLACK_PX = 2;
const WHEEL_RADIUS = "(50% - var(--color-picker-wheel-thickness) / 2)";

export type ColorPickerWheelProps = Omit<React.ComponentProps<"div">, "ref">;

/**
 * A hue ring. Children fill the square inscribed in its hole: an area there
 * gives the classic ring-and-square picker. `--color-picker-wheel-thickness`
 * sets the ring's width.
 */
const ColorPickerWheel = React.forwardRef<HTMLDivElement, ColorPickerWheelProps>(function ColorPickerWheel(
	{ className, children, onKeyDown, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerWheel");
	const [hue] = toSpace(context.display, "hsv");
	const { emit, getColor, startInteraction, endInteraction, editable } = context;
	const set = React.useCallback(
		(next: number): void => {
			emit(withChannel(getColor(), "hsv", "hue", wrapHue(Math.round(next))));
		},
		[emit, getColor],
	);
	const { dragging, handlers } = useColorPickerDrag(context, (event: React.PointerEvent<HTMLElement>, element: HTMLElement): void => {
		const rect = element.getBoundingClientRect();
		const x = event.clientX - rect.left - rect.width / 2;
		const y = event.clientY - rect.top - rect.height / 2;
		set(radiansToDegrees(Math.atan2(x, -y)));
	});
	const { onPointerDown: startDrag } = handlers;
	/* Only the ring starts a drag. The thumb rides the ring's middle, so the hole's edge is that radius times two, less the outer radius. */
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			const rect = event.currentTarget.getBoundingClientRect();
			const thumb = event.currentTarget.querySelector("[data-slot=color-picker-wheel-thumb]")?.getBoundingClientRect();
			if (thumb !== undefined) {
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;
				const middle = Math.hypot(thumb.left + thumb.width / 2 - centerX, thumb.top + thumb.height / 2 - centerY);
				const inner = 2 * middle - rect.width / 2;
				const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
				if (distance < inner - WHEEL_HOLE_SLACK_PX) {
					return;
				}
			}
			startDrag(event);
		},
		[startDrag],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || copyOnShortcut(event, context) || !editable) {
				return;
			}
			const delta = keyDelta(event, 1);
			if (delta === null) {
				return;
			}
			event.preventDefault();
			startInteraction();
			if (Number.isFinite(delta)) {
				set(Math.round(hue) + delta);
			} else {
				set(delta > 0 ? WHEEL_HUE_KEY_MAX : 0);
			}
			endInteraction();
		},
		[context, editable, endInteraction, hue, onKeyDown, set, startInteraction],
	);
	const angle = degreesToRadians(hue);
	const thumbStyle = React.useMemo(
		(): React.CSSProperties => ({
			left: `calc(50% + ${WHEEL_RADIUS} * ${String(Math.sin(angle))})`,
			top: `calc(50% - ${WHEEL_RADIUS} * ${String(Math.cos(angle))})`,
		}),
		[angle],
	);

	return (
		<div ref={ref} data-slot="color-picker-wheel" className={cn("relative size-48 shrink-0 [--color-picker-wheel-thickness:calc(var(--spacing)*5)]", className)} {...props}>
			<div
				role="slider"
				tabIndex={context.disabled ? -1 : 0}
				aria-label={context.i18n.labels.hue}
				aria-valuemin={0}
				aria-valuemax={HUE_MAX_DEGREES}
				aria-valuenow={Math.round(hue)}
				aria-valuetext={channelValueText(context.display, "hsv", "hue", context.i18n)}
				aria-disabled={context.disabled ? true : undefined}
				aria-readonly={context.readOnly ? true : undefined}
				data-slot="color-picker-wheel-track"
				data-dragging={dragging ? "" : undefined}
				className={cn(colorPickerControlVariants({ state: context.state }), "absolute inset-0 touch-none rounded-full")}
				onKeyDown={handleKeyDown}
				{...handlers}
				onPointerDown={handlePointerDown}>
				<div className={WHEEL_RING_CLASS} style={WHEEL_RING_STYLE} />
				<div data-slot="color-picker-wheel-thumb" className={COLOR_PICKER_THUMB_CLASS} style={thumbStyle} />
			</div>
			{children === undefined ? null : (
				<div className="absolute inset-[calc(50%-(50%-var(--color-picker-wheel-thickness))*0.7071+var(--spacing)*1.5)] flex items-center justify-center">{children}</div>
			)}
		</div>
	);
});

/* -------------------------------- Actions -------------------------------- */

const EyeDropperResultSchema = z.object({ sRGBHex: z.string() });

type EyeDropperResult = z.infer<typeof EyeDropperResultSchema>;

interface EyeDropperInstance {
	readonly open: () => Promise<EyeDropperResult>;
}

type EyeDropperConstructor = new () => EyeDropperInstance;

/** The browser's EyeDropper constructor, checked structurally (it is a callable) before use. */
const EyeDropperConstructorSchema = z.custom<EyeDropperConstructor>((value): boolean => z.function().safeParse(value).success);

function readEyeDropper(): EyeDropperConstructor | null {
	const parsed = EyeDropperConstructorSchema.safeParse(Reflect.get(globalThis, "EyeDropper"));
	return parsed.success ? parsed.data : null;
}

function subscribeToNothing(): () => void {
	return (): void => {
		return;
	};
}

function hasEyeDropper(): boolean {
	return hasGlobalConstructor("EyeDropper");
}

function hasEyeDropperOnServer(): boolean {
	return false;
}

export type ColorPickerActionProps = Omit<React.ComponentProps<typeof Button>, "ref">;

/**
 * Samples a colour from anywhere on screen, keeping the current opacity.
 * Renders nothing where the browser has no EyeDropper (Firefox, Safari).
 */
const ColorPickerEyeDropper = React.forwardRef<HTMLElement, ColorPickerActionProps>(function ColorPickerEyeDropper(
	{ variant = "ghost", size = "icon-sm", onClick, children, ...props },
	ref,
): React.JSX.Element | null {
	const context = useColorPickerContext("ColorPickerEyeDropper");
	/* False on the server and in the first client render, so markup matches. */
	const isSupported = React.useSyncExternalStore(subscribeToNothing, hasEyeDropper, hasEyeDropperOnServer);
	const { change, getColor } = context;
	const pick = React.useCallback(
		async (EyeDropper: EyeDropperConstructor): Promise<void> => {
			try {
				const result = EyeDropperResultSchema.parse(await new EyeDropper().open());
				const picked = parseColor(result.sRGBHex);
				if (picked !== null) {
					change({ ...picked, alpha: getColor().alpha });
				}
			} catch (error: unknown) {
				/* Escape cancels the sampler with an AbortError: nothing was picked. */
				if (!(error instanceof DOMException)) {
					throw error;
				}
			}
		},
		[change, getColor],
	);
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			const EyeDropper = readEyeDropper();
			if (event.defaultPrevented || EyeDropper === null) {
				return;
			}
			void pick(EyeDropper);
		},
		[onClick, pick],
	);
	if (!isSupported) {
		return null;
	}
	return (
		<Button
			ref={ref}
			type="button"
			variant={variant}
			size={size}
			disabled={!context.editable}
			aria-label={context.i18n.labels.eyeDropper}
			data-slot="color-picker-eye-dropper"
			onClick={handleClick}
			{...props}>
			{children === undefined ? <PipetteIcon aria-hidden="true" /> : children}
		</Button>
	);
});

export type ColorPickerCopyProps = ColorPickerActionProps & {
	/** The format copied. Defaults to the format on screen. */
	readonly format?: ColorPickerFormat | undefined;
};

/**
 * Copies the value and confirms for a moment, in `format` or, by default, the
 * format on screen: what the fields show, else the picker's.
 */
const ColorPickerCopy = React.forwardRef<HTMLElement, ColorPickerCopyProps>(function ColorPickerCopy(
	{ format, variant = "ghost", size = "icon-sm", onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerCopy");
	const target = format ?? context.shownFormat;
	const isCopied = context.copied === target;
	const { labels } = context.i18n;
	const { copy } = context;
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			if (!event.defaultPrevented) {
				copy(target);
			}
		},
		[copy, onClick, target],
	);
	const icon = isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />;
	return (
		<Button
			ref={ref}
			type="button"
			variant={variant}
			size={size}
			disabled={context.disabled || context.color === null}
			aria-label={isCopied ? labels.copied : labels.copy}
			aria-keyshortcuts="Control+C Meta+C"
			data-slot="color-picker-copy"
			data-copied={isCopied ? "" : undefined}
			onClick={handleClick}
			{...props}>
			{children === undefined ? icon : children}
		</Button>
	);
});

/**
 * Empties the value, for an optional colour. It stays enabled while empty:
 * disabling itself on click would drop keyboard focus to the page.
 */
const ColorPickerClear = React.forwardRef<HTMLElement, ColorPickerActionProps>(function ColorPickerClear(
	{ variant = "ghost", size = "sm", onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerClear");
	const { change } = context;
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			if (!event.defaultPrevented) {
				change(null);
			}
		},
		[change, onClick],
	);
	return (
		<Button ref={ref} type="button" variant={variant} size={size} disabled={!context.editable} data-slot="color-picker-clear" onClick={handleClick} {...props}>
			{children === undefined ? context.i18n.labels.clear : children}
		</Button>
	);
});

export { ColorPickerArea, ColorPickerClear, ColorPickerCopy, ColorPickerEyeDropper, ColorPickerSlider, ColorPickerWheel };
