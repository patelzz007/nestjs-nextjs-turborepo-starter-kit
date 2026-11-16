// A colour picked by eye or typed (the web kit's `ColorPicker`): an area for
// saturation and brightness, a hue slider, an optional opacity slider, preset
// swatches and a typed value in hex, rgb(), hsl() or oklch(). Each part is
// exported for a layout of its own (`ColorPickerArea`, `ColorPickerHue`,
// `ColorPickerAlpha`, `ColorPickerSwatch`, `ColorPickerInput`); `ColorPicker`
// sets them out together, and `ColorPickerField` is a field showing the colour
// that opens them in a bottom sheet.
//
// Controlled: `value` is the colour as hex (`#3b82f6`, or `#3b82f680` when it
// is see-through), `onChange(next)` reports it. The area and sliders are
// dragged with a finger, and are adjustable for screen readers (a swipe moves
// them a step). The colours drawn are the colour being picked — data, not
// theme tokens; everything around them is tokens. The maths is
// lib/color.ts.

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import * as React from "react";
import { type AccessibilityActionEvent, type LayoutChangeEvent, Pressable, Text, TextInput, View, type ViewInstance, type GestureResponderEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { cn } from "../lib/cn";
import { formatColor, hsvToRgb, parseColor, parseHex, rgbToHsv, toHex, type ColorFormat, type Hsva, type Rgba } from "../lib/color";
import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icon";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";

export const colorSwatchVariants = cva("items-center justify-center border border-border", {
	variants: {
		size: { sm: "size-7 rounded-md", md: "size-9 rounded-lg", lg: "size-11 rounded-lg" },
		shape: { square: "", round: "rounded-full" },
		picked: { true: "border-2 border-ring", false: "" },
	},
	defaultVariants: { size: "md", shape: "square", picked: false },
});

export type ColorSwatchSize = NonNullable<VariantProps<typeof colorSwatchVariants>["size"]>;

const HUE_TURN = 360;
const HUE_STEP = 1;
const AREA_STEP = 0.02;
const ALPHA_STEP = 0.05;
const PERCENT = 100;
/** The hue slider's rainbow: a stop every sixth of the turn. */
const HUE_STOPS: readonly number[] = [0, 60, 120, 180, 240, 300, 360];
const THUMB_SIZE = 24;
/** What an unreadable value is drawn as. */
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const HALF = 0.5;

/** A colour held as HSV, so a grey keeps its hue while it is dragged through. */
function useHsv(value: string): readonly [Hsva, (next: Hsva) => Hsva] {
	const [hsv, setHsv] = React.useState<Hsva>((): Hsva => rgbToHsv(parseHex(value) ?? BLACK));
	const shown = toHex(hsvToRgb(hsv)) === value ? hsv : rgbToHsv(parseHex(value) ?? hsvToRgb(hsv));
	const remember = React.useCallback((next: Hsva): Hsva => {
		setHsv(next);
		return next;
	}, []);
	return [shown, remember];
}

/** A measured box's size, in points. */
interface BoxSize {
	readonly width: number;
	readonly height: number;
}

/** The responder props that make a view draggable. */
interface DragHandlers {
	readonly onStartShouldSetResponder: () => boolean;
	readonly onMoveShouldSetResponder: () => boolean;
	readonly onResponderTerminationRequest: () => boolean;
	readonly onResponderGrant: (event: GestureResponderEvent) => void;
	readonly onResponderMove: (event: GestureResponderEvent) => void;
}

interface Drag {
	readonly size: BoxSize;
	readonly onLayout: (event: LayoutChangeEvent) => void;
	readonly handlers: DragHandlers;
}

const ALWAYS = (): boolean => true;
const NEVER = (): boolean => false;

/** React Native's gesture responder over a measured box (the kit's `Slider` does the same), reported as fractions 0–1. */
function useDrag(onMove: (x: number, y: number) => void): Drag {
	const [size, setSize] = React.useState<BoxSize>({ width: 1, height: 1 });
	const onLayout = React.useCallback((event: LayoutChangeEvent): void => {
		setSize({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) });
	}, []);
	const report = React.useCallback(
		(event: GestureResponderEvent): void => {
			const { locationX, locationY } = event.nativeEvent;
			onMove(Math.min(1, Math.max(0, locationX / size.width)), Math.min(1, Math.max(0, locationY / size.height)));
		},
		[onMove, size],
	);
	const handlers = React.useMemo(
		(): DragHandlers => ({
			onStartShouldSetResponder: ALWAYS,
			onMoveShouldSetResponder: ALWAYS,
			onResponderTerminationRequest: NEVER,
			onResponderGrant: report,
			onResponderMove: report,
		}),
		[report],
	);
	return { size, onLayout, handlers };
}

const ADJUSTABLE_ACTIONS: readonly { readonly name: "increment" | "decrement" }[] = [{ name: "increment" }, { name: "decrement" }];

interface ColorPartProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** The part's name for screen readers. */
	readonly accessibilityLabel?: string | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export type ColorPickerAreaProps = ColorPartProps;

/** Saturation (across) and brightness (up) at the colour's hue. */
export const ColorPickerArea = React.memo(
	React.forwardRef<ViewInstance, ColorPickerAreaProps>(function ColorPickerArea(
		{ value, onChange, accessibilityLabel = "Saturation and brightness", className, testID },
		ref,
	): React.JSX.Element {
		const [hsv, remember] = useHsv(value);
		const pick = React.useCallback(
			(x: number, y: number): void => {
				onChange(toHex(hsvToRgb(remember({ ...hsv, s: x, v: 1 - y }))));
			},
			[hsv, onChange, remember],
		);
		const { size, onLayout, handlers } = useDrag(pick);
		const hueColor = toHex(hsvToRgb({ h: hsv.h, s: 1, v: 1, a: 1 }));
		const thumbStyle = React.useMemo(
			() => ({ left: hsv.s * size.width - THUMB_SIZE * HALF, top: (1 - hsv.v) * size.height - THUMB_SIZE * HALF, backgroundColor: toHex(hsvToRgb({ ...hsv, a: 1 })) }),
			[hsv, size],
		);
		const onAccessibilityAction = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				const delta = event.nativeEvent.actionName === "increment" ? AREA_STEP : -AREA_STEP;
				onChange(toHex(hsvToRgb(remember({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + delta)), v: Math.min(1, Math.max(0, hsv.v + delta)) }))));
			},
			[hsv, onChange, remember],
		);
		const accessibilityValue = React.useMemo(
			() => ({ text: `Saturation ${String(Math.round(hsv.s * PERCENT))}%, brightness ${String(Math.round(hsv.v * PERCENT))}%` }),
			[hsv],
		);
		return (
			<View
				ref={ref}
				testID={testID}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={accessibilityValue}
				accessibilityActions={ADJUSTABLE_ACTIONS}
				onAccessibilityAction={onAccessibilityAction}
				onLayout={onLayout}
				className={cn("h-44 w-full overflow-hidden rounded-lg", className)}
				{...handlers}>
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id="saturation" x1="0" y1="0" x2="1" y2="0">
							<Stop offset="0" stopColor="white" />
							<Stop offset="1" stopColor={hueColor} />
						</LinearGradient>
						<LinearGradient id="brightness" x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor="black" stopOpacity="0" />
							<Stop offset="1" stopColor="black" />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill="url(#saturation)" />
					<Rect width="100%" height="100%" fill="url(#brightness)" />
				</Svg>
				<View pointerEvents="none" style={thumbStyle} className="absolute size-6 rounded-full border-2 border-background shadow-md" />
			</View>
		);
	}),
);

interface SliderTrackProps extends ColorPartProps {
	/** The position along the track, 0–1. */
	readonly fraction: number;
	readonly onFraction: (fraction: number) => void;
	readonly step: number;
	readonly valueText: string;
	readonly stops: readonly { readonly offset: number; readonly color: string; readonly opacity: number }[];
	readonly thumbColor: string;
	readonly gradientId: string;
}

/** A horizontal gradient track with a round thumb: the hue and opacity sliders. */
const SliderTrack = React.forwardRef<ViewInstance, SliderTrackProps>(function SliderTrack(
	{ fraction, onFraction, step, valueText, stops, thumbColor, gradientId, accessibilityLabel, className, testID },
	ref,
): React.JSX.Element {
	const moveTo = React.useCallback(
		(x: number): void => {
			onFraction(x);
		},
		[onFraction],
	);
	const { size, onLayout, handlers } = useDrag(moveTo);
	const thumbStyle = React.useMemo(() => ({ left: fraction * size.width - THUMB_SIZE * HALF, backgroundColor: thumbColor }), [fraction, size.width, thumbColor]);
	const onAccessibilityAction = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			onFraction(Math.min(1, Math.max(0, fraction + (event.nativeEvent.actionName === "increment" ? step : -step))));
		},
		[fraction, onFraction, step],
	);
	const accessibilityValue = React.useMemo(() => ({ text: valueText }), [valueText]);
	return (
		<View
			ref={ref}
			testID={testID}
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={accessibilityValue}
			accessibilityActions={ADJUSTABLE_ACTIONS}
			onAccessibilityAction={onAccessibilityAction}
			onLayout={onLayout}
			className={cn("h-6 w-full justify-center", className)}
			{...handlers}>
			<View className="h-3 w-full overflow-hidden rounded-full border border-border">
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
							{stops.map((stop): React.JSX.Element => (
								<Stop key={String(stop.offset)} offset={String(stop.offset)} stopColor={stop.color} stopOpacity={String(stop.opacity)} />
							))}
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
				</Svg>
			</View>
			<View pointerEvents="none" style={thumbStyle} className="absolute size-6 rounded-full border-2 border-background shadow-md" />
		</View>
	);
});

export type ColorPickerHueProps = ColorPartProps;

/** The colour's hue, along the rainbow. */
export const ColorPickerHue = React.memo(
	React.forwardRef<ViewInstance, ColorPickerHueProps>(function ColorPickerHue({ value, onChange, accessibilityLabel = "Hue", className, testID }, ref): React.JSX.Element {
		const [hsv, remember] = useHsv(value);
		const onFraction = React.useCallback(
			(fraction: number): void => {
				onChange(toHex(hsvToRgb(remember({ ...hsv, h: Math.min(HUE_TURN - HUE_STEP, fraction * HUE_TURN) }))));
			},
			[hsv, onChange, remember],
		);
		const stops = React.useMemo(
			() => HUE_STOPS.map((hue: number) => ({ offset: hue / HUE_TURN, color: toHex(hsvToRgb({ h: hue % HUE_TURN, s: 1, v: 1, a: 1 })), opacity: 1 })),
			[],
		);
		return (
			<SliderTrack
				ref={ref}
				value={value}
				onChange={onChange}
				fraction={hsv.h / HUE_TURN}
				onFraction={onFraction}
				step={HUE_STEP / HUE_TURN}
				valueText={`${String(Math.round(hsv.h))} degrees`}
				stops={stops}
				thumbColor={toHex(hsvToRgb({ h: hsv.h, s: 1, v: 1, a: 1 }))}
				gradientId="hue"
				accessibilityLabel={accessibilityLabel}
				className={className}
				testID={testID}
			/>
		);
	}),
);

export type ColorPickerAlphaProps = ColorPartProps;

/** The colour's opacity, from see-through to solid. */
export const ColorPickerAlpha = React.memo(
	React.forwardRef<ViewInstance, ColorPickerAlphaProps>(function ColorPickerAlpha(
		{ value, onChange, accessibilityLabel = "Opacity", className, testID },
		ref,
	): React.JSX.Element {
		const [hsv, remember] = useHsv(value);
		const onFraction = React.useCallback(
			(fraction: number): void => {
				onChange(toHex(hsvToRgb(remember({ ...hsv, a: Math.round(fraction / ALPHA_STEP) * ALPHA_STEP }))));
			},
			[hsv, onChange, remember],
		);
		const solid = toHex(hsvToRgb({ ...hsv, a: 1 }));
		const stops = React.useMemo(
			() => [
				{ offset: 0, color: solid, opacity: 0 },
				{ offset: 1, color: solid, opacity: 1 },
			],
			[solid],
		);
		return (
			<SliderTrack
				ref={ref}
				value={value}
				onChange={onChange}
				fraction={hsv.a}
				onFraction={onFraction}
				step={ALPHA_STEP}
				valueText={`${String(Math.round(hsv.a * PERCENT))}%`}
				stops={stops}
				thumbColor={solid}
				gradientId="alpha"
				accessibilityLabel={accessibilityLabel}
				className={className}
				testID={testID}
			/>
		);
	}),
);

export interface ColorPickerSwatchProps {
	/** The swatch's colour, as hex. */
	readonly color: string;
	/** Its name for screen readers ("Ocean blue"); defaults to the hex. */
	readonly label?: string | undefined;
	/** Makes the swatch pickable. Left out, it only shows the colour. */
	readonly onPress?: ((color: string) => void) | undefined;
	readonly picked?: boolean | undefined;
	readonly size?: ColorSwatchSize | undefined;
	readonly shape?: "square" | "round" | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A chip of one colour: a preset to pick, or a preview. */
export const ColorPickerSwatch = React.memo(
	React.forwardRef<ViewInstance, ColorPickerSwatchProps>(function ColorPickerSwatch(
		{ color, label, onPress, picked = false, size = "md", shape = "square", className, testID },
		ref,
	): React.JSX.Element {
		const fill = React.useMemo(() => ({ backgroundColor: color }), [color]);
		const press = React.useCallback((): void => {
			onPress?.(color);
		}, [color, onPress]);
		const selected = React.useMemo(() => ({ selected: picked }), [picked]);
		// The ring (`border-ring`) marks the picked swatch on any colour; the check is the same near-white in every theme.
		const glyph = picked ? <Icon icon={CheckIcon} size="sm" weight="bold" colorClassName="accent-status-foreground" /> : null;
		if (onPress === undefined) {
			return (
				<View
					ref={ref}
					testID={testID}
					accessible
					accessibilityRole="image"
					accessibilityLabel={label ?? color}
					style={fill}
					className={cn(colorSwatchVariants({ size, shape, picked }), className)}>
					{glyph}
				</View>
			);
		}
		return (
			<Pressable
				ref={ref}
				testID={testID}
				accessibilityRole="button"
				accessibilityLabel={label ?? color}
				accessibilityState={selected}
				onPress={press}
				style={fill}
				className={cn(colorSwatchVariants({ size, shape, picked }), className)}>
				{glyph}
			</Pressable>
		);
	}),
);

const FORMAT_OPTIONS: readonly SegmentedOption<ColorFormat>[] = [
	{ value: "hex", label: "HEX" },
	{ value: "rgb", label: "RGB" },
	{ value: "hsl", label: "HSL" },
	{ value: "oklch", label: "OKLCH" },
];

export interface ColorPickerInputProps extends ColorPartProps {
	/** The form the value is written in. */
	readonly format?: ColorFormat | undefined;
	/** Shows a switch between the forms; `onFormatChange` reports the new one. */
	readonly onFormatChange?: ((format: ColorFormat) => void) | undefined;
	/** The forms the switch offers (default all four). */
	readonly formats?: readonly ColorFormat[] | undefined;
}

/** The colour typed: read when the field is left, or on return; text that is not a colour is put back. */
export const ColorPickerInput = React.memo(
	React.forwardRef<ViewInstance, ColorPickerInputProps>(function ColorPickerInput(
		{ value, onChange, format = "hex", onFormatChange, formats, accessibilityLabel = "Colour", className, testID },
		ref,
	): React.JSX.Element {
		const color = parseHex(value);
		const written = color === null ? value : formatColor(color, format);
		const [draft, setDraft] = React.useState<string | null>(null);
		const commit = React.useCallback((): void => {
			const parsed = draft === null ? null : parseColor(draft);
			if (parsed !== null) {
				onChange(toHex(parsed));
			}
			setDraft(null);
		}, [draft, onChange]);
		const options = React.useMemo(
			(): readonly SegmentedOption<ColorFormat>[] =>
				formats === undefined ? FORMAT_OPTIONS : FORMAT_OPTIONS.filter((option: SegmentedOption<ColorFormat>): boolean => formats.includes(option.value)),
			[formats],
		);
		return (
			<View ref={ref} className={cn("gap-2", className)}>
				{onFormatChange === undefined ? null : <SegmentedControl label="Colour format" options={options} value={format} onChange={onFormatChange} size="sm" />}
				<View className="rounded-button min-h-11 flex-row items-center gap-2 border border-input px-3">
					<ColorPickerSwatch color={value} size="sm" />
					<TextInput
						value={draft ?? written}
						onChangeText={setDraft}
						onBlur={commit}
						onSubmitEditing={commit}
						autoCapitalize="none"
						autoCorrect={false}
						accessibilityLabel={accessibilityLabel}
						testID={testID}
						className="text-body font-code flex-1 text-foreground"
					/>
				</View>
			</View>
		);
	}),
);

export interface ColorPickerProps extends ColorPartProps {
	/** Shows the opacity slider. */
	readonly showAlpha?: boolean | undefined;
	/** Preset colours as hex, offered as swatches. */
	readonly presets?: readonly string[] | undefined;
	/** Shows the typed value. */
	readonly showInput?: boolean | undefined;
	readonly format?: ColorFormat | undefined;
	readonly onFormatChange?: ((format: ColorFormat) => void) | undefined;
	readonly formats?: readonly ColorFormat[] | undefined;
}

/** The parts together: the area, the hue, the opacity, the typed value and the presets. */
export const ColorPicker = React.memo(
	React.forwardRef<ViewInstance, ColorPickerProps>(function ColorPicker(
		{ value, onChange, showAlpha = false, presets, showInput = true, format, onFormatChange, formats, className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn("gap-3", className)}>
				<ColorPickerArea value={value} onChange={onChange} />
				<ColorPickerHue value={value} onChange={onChange} />
				{showAlpha ? <ColorPickerAlpha value={value} onChange={onChange} /> : null}
				{showInput ? <ColorPickerInput value={value} onChange={onChange} format={format} onFormatChange={onFormatChange} formats={formats} /> : null}
				{presets === undefined ? null : (
					<View accessibilityLabel="Presets" className="flex-row flex-wrap gap-2">
						{presets.map((preset: string): React.JSX.Element => (
							<ColorPickerSwatch key={preset} color={preset} onPress={onChange} picked={preset.toLowerCase() === value.toLowerCase()} />
						))}
					</View>
				)}
			</View>
		);
	}),
);

export interface ColorPickerFieldProps extends ColorPickerProps {
	/** The field's name, and the sheet's title. */
	readonly label: string;
	/** Draws only the swatch, as a square button (a toolbar's colour). */
	readonly compact?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The sheet's close button. */
	readonly doneLabel?: string | undefined;
}

/** A field showing the colour (its swatch and its value), opening the picker in a sheet. */
export const ColorPickerField = React.memo(
	React.forwardRef<ViewInstance, ColorPickerFieldProps>(function ColorPickerField(
		{ label, compact = false, disabled = false, doneLabel = "Done", value, format = "hex", className, testID, ...picker },
		ref,
	): React.JSX.Element {
		const [open, setOpen] = React.useState<boolean>(false);
		const show = React.useCallback((): void => {
			setOpen(true);
		}, []);
		const hide = React.useCallback((): void => {
			setOpen(false);
		}, []);
		const color = parseHex(value);
		const written = color === null ? value : formatColor(color, format);
		const state = React.useMemo(() => ({ disabled, expanded: open }), [disabled, open]);
		return (
			<>
				<Pressable
					ref={ref}
					testID={testID}
					accessibilityRole="button"
					accessibilityLabel={`${label}, ${written}`}
					accessibilityState={state}
					disabled={disabled}
					onPress={show}
					className={cn(
						compact
							? "active:bg-surface-selected size-11 items-center justify-center rounded-lg"
							: "rounded-button active:bg-surface-selected min-h-12 flex-row items-center gap-3 border border-input px-3",
						disabled ? "opacity-60" : undefined,
						className,
					)}>
					<ColorPickerSwatch color={value} size={compact ? "sm" : "md"} />
					{compact ? null : <Text className="text-body-lg font-code flex-1 text-foreground">{written}</Text>}
				</Pressable>
				<BottomSheet visible={open} title={label} onClose={hide} closeLabel={doneLabel} testID={testID === undefined ? undefined : `${testID}-sheet`}>
					<ColorPicker value={value} format={format} {...picker} />
				</BottomSheet>
			</>
		);
	}),
);

/** The hue of a colour, for callers that build palettes from it. */
export function hueOf(value: string): number {
	return rgbToHsv(parseHex(value) ?? BLACK).h;
}
