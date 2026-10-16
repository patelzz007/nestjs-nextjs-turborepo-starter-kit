"use client";

import { copyOnShortcut, useColorPickerContext, useEscapeRevert } from "@workspace/ui/components/color-picker-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Separator } from "@workspace/ui/components/separator";
import { COLOR_PICKER_FORMATS, formatColor } from "@workspace/ui/lib/color/color-format";
import { channelText, readChannelText, type ColorFieldChannel } from "@workspace/ui/lib/color/color-fields";
import {
	channelRange,
	clamp,
	readChannel,
	resolveChannelSpace,
	snapToStep,
	withChannel,
	wrapHue,
	type ColorPickerColorSpace,
	type ColorPickerFormat,
} from "@workspace/ui/lib/color/color-space";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { flushSync } from "react-dom";
import { z } from "zod";

/* Arrows step a field, ten with Shift; Page keys always ten. A hue wraps. */
const STEP_KEYS: ReadonlyMap<string, number> = new Map([
	["ArrowUp", 1],
	["ArrowDown", -1],
	["PageUp", 10],
	["PageDown", -10],
]);
const SHIFT_STEP_MULTIPLIER = 10;
const ALPHA_FIELD_STEP = 0.01;
const CHROMA_FIELD_STEP = 0.001;
const ALPHA_PERCENT_SCALE = 100;
/** `#` plus eight hex digits. */
const HEX_FIELD_MAX_LENGTH = 9;
const NUMBER_FIELD_MAX_LENGTH = 8;

/*
 * Each field starts at its widest value plus padding, in ch so it tracks the
 * font: 255 or 360, 99.9 for OKLCH lightness, 0.399, 359.9, 100% and six hex
 * digits. A short row shrinks every field in proportion.
 */
function channelWidthClass(channel: ColorFieldChannel, space: ColorPickerColorSpace): string {
	if (channel === "hex") {
		return "flex-[1_1_calc(5.8ch+0.75rem)] uppercase";
	}
	if (channel === "alpha") {
		return "flex-[1_1_calc(4.8ch+0.75rem)]";
	}
	if (space !== "oklch") {
		return "flex-[1_1_calc(3.25ch+0.75rem)]";
	}
	return channel === "lightness" ? "flex-[1_1_calc(3.7ch+0.75rem)]" : "flex-[1_1_calc(4.7ch+0.75rem)]";
}

function fieldStep(channel: ColorFieldChannel): number {
	if (channel === "alpha") {
		return ALPHA_FIELD_STEP;
	}
	return channel === "chroma" ? CHROMA_FIELD_STEP : 1;
}

export type ColorPickerChannelInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "defaultValue" | "ref"> & {
	/** A channel, or `"hex"` for the six hex digits. */
	readonly channel: ColorFieldChannel;
	readonly colorSpace?: ColorPickerColorSpace | undefined;
};

/**
 * One channel as a borderless field for an `InputGroup`. Text is read on blur
 * and Enter; ArrowUp and ArrowDown step it, Shift by ten.
 */
const ColorPickerChannelInput = React.forwardRef<HTMLInputElement, ColorPickerChannelInputProps>(function ColorPickerChannelInput(
	{ channel, colorSpace, className, onBlur, onKeyDown, onChange, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerChannelInput");
	const space = channel === "hex" ? "rgb" : resolveChannelSpace(channel, colorSpace);
	const [text, setText] = React.useState<string | null>(null);
	const current = channelText(context.display, space, channel);
	const shown = text ?? current;
	const fieldRef = React.useRef<HTMLInputElement | null>(null);
	const revert = React.useCallback((): void => {
		setText(null);
	}, []);
	useEscapeRevert(fieldRef, text !== null, revert);
	const handleRef = React.useMemo(() => mergeRefs<HTMLInputElement>(fieldRef, ref), [ref]);
	const { max } = channelRange(space, channel === "hex" ? "red" : channel);
	const isNumber = channel !== "hex";
	const { change, display, editable } = context;

	const read = React.useCallback((): void => {
		if (text === null) {
			return;
		}
		setText(null);
		if (text === current) {
			return;
		}
		const next = readChannelText(text, display, space, channel);
		if (next !== null) {
			change(next);
		}
	}, [change, channel, current, display, space, text]);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.(event);
			setText(event.target.value);
		},
		[onChange],
	);
	const handleBlur = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>): void => {
			onBlur?.(event);
			read();
		},
		[onBlur, read],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || copyOnShortcut(event, context)) {
				return;
			}
			const step = STEP_KEYS.get(event.key);
			if (event.key === "Enter") {
				/* Flushed, so an implicit form submit reads the new value. */
				flushSync(read);
				return;
			}
			if (step === undefined || channel === "hex" || !editable) {
				return;
			}
			event.preventDefault();
			const from = readChannelText(shown, display, space, channel);
			if (from === null) {
				return;
			}
			const unit = fieldStep(channel);
			const delta = step * unit * (event.shiftKey ? SHIFT_STEP_MULTIPLIER : 1);
			const { max: top } = channelRange(space, channel);
			const next = snapToStep(readChannel(from, space, channel) + delta, unit);
			setText(null);
			change(withChannel(from, space, channel, channel === "hue" ? wrapHue(next) : clamp(next, 0, top)));
		},
		[change, channel, context, display, editable, onKeyDown, read, shown, space],
	);

	return (
		<InputGroupInput
			value={shown}
			inputMode={isNumber ? "decimal" : "text"}
			maxLength={isNumber ? NUMBER_FIELD_MAX_LENGTH : HEX_FIELD_MAX_LENGTH}
			disabled={context.disabled}
			readOnly={context.readOnly}
			autoComplete="off"
			autoCorrect="off"
			autoCapitalize="off"
			spellCheck={false}
			aria-label={context.i18n.labels[channel]}
			/* A number field is a spin button: a screen reader hears its range. */
			role={isNumber ? "spinbutton" : undefined}
			aria-valuemin={isNumber ? 0 : undefined}
			aria-valuemax={isNumber ? (channel === "alpha" ? ALPHA_PERCENT_SCALE : max) : undefined}
			aria-valuenow={isNumber ? (channel === "alpha" ? Math.round(display.alpha * ALPHA_PERCENT_SCALE) : Number(current)) : undefined}
			aria-valuetext={isNumber ? shown : undefined}
			data-channel={channel}
			className={cn("h-auto min-w-0 self-stretch pr-1 pl-2 tabular-nums", channelWidthClass(channel, space), className)}
			onChange={handleChange}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
			{...props}
			ref={handleRef}
		/>
	);
});

interface FormatFields {
	readonly space: ColorPickerColorSpace;
	readonly channels: readonly ColorFieldChannel[];
}

const FORMAT_FIELDS: Readonly<Record<ColorPickerFormat, FormatFields>> = {
	hex: { space: "rgb", channels: ["hex"] },
	rgb: { space: "rgb", channels: ["red", "green", "blue"] },
	hsl: { space: "hsl", channels: ["hue", "saturation", "lightness"] },
	hsb: { space: "hsv", channels: ["hue", "saturation", "brightness"] },
	oklch: { space: "oklch", channels: ["lightness", "chroma", "hue"] },
};

const ColorPickerFormatSchema = z.enum(["hex", "rgb", "hsl", "hsb", "oklch"]);
const FUNCTION_WRAPPER_PATTERN = /^\w+\(|\)$/gu;

/** The joined fields: a `state` axis dims the group while disabled. */
const colorPickerFieldsVariants = cva("", {
	variants: {
		state: {
			default: "",
			loading: "opacity-80",
			disabled: "opacity-50",
			error: "",
		},
	},
	defaultVariants: { state: "default" },
});

export type ColorPickerFieldsProps = Omit<React.ComponentProps<typeof InputGroup>, "children" | "ref"> & {
	/** The format shown, controlled. It does not change what `onValueChange` emits. */
	readonly format?: ColorPickerFormat | undefined;
	/** Defaults to the picker's `format`. */
	readonly defaultFormat?: ColorPickerFormat | undefined;
	readonly onFormatChange?: ((format: ColorPickerFormat) => void) | undefined;
	/** The formats in the menu. One format hides the menu. */
	readonly formats?: readonly ColorPickerFormat[] | undefined;
};

function stopPropagation(event: React.MouseEvent<HTMLDivElement>): void {
	event.stopPropagation();
}

/**
 * A format menu and the value's channels as joined fields: one hex field, or
 * three channels, plus opacity when the picker takes alpha.
 */
const ColorPickerFields = React.forwardRef<HTMLDivElement, ColorPickerFieldsProps>(function ColorPickerFields(
	{ format: formatProp, defaultFormat, onFormatChange, formats = COLOR_PICKER_FORMATS, className, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerFields");
	const [formatState, setFormatState] = React.useState<ColorPickerFormat>(defaultFormat ?? context.format);
	const shown = formatProp ?? formatState;
	const fields = FORMAT_FIELDS[shown];
	const { setFieldsFormat } = context;
	const { labels } = context.i18n;
	React.useLayoutEffect((): (() => void) => {
		setFieldsFormat(shown);
		return (): void => {
			setFieldsFormat(null);
		};
	}, [shown, setFieldsFormat]);
	const hasMenu = formats.length > 1;
	const handleFormatChange = React.useCallback(
		(next: string): void => {
			const parsed = ColorPickerFormatSchema.safeParse(next);
			if (!parsed.success) {
				return;
			}
			if (formatProp === undefined) {
				setFormatState(parsed.data);
			}
			onFormatChange?.(parsed.data);
		},
		[formatProp, onFormatChange],
	);

	return (
		<InputGroup
			ref={ref}
			dir="ltr"
			data-slot="color-picker-fields"
			data-disabled={context.disabled ? "" : undefined}
			className={cn(colorPickerFieldsVariants({ state: context.state }), className)}
			{...props}>
			{hasMenu ? (
				<InputGroupAddon align="inline-start" className="pe-1">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<InputGroupButton
									size="xs"
									disabled={context.disabled}
									aria-label={labels.formatTrigger(labels.formatNames[shown])}
									data-slot="color-picker-format-trigger"
									className="gap-1 text-xs font-medium"
								/>
							}>
							{labels.formatNames[shown]}
							<ChevronDownIcon aria-hidden="true" />
						</DropdownMenuTrigger>
						{/* A pick's click bubbles through the portal to InputGroupAddon, whose own handler would move focus into a field. */}
						<DropdownMenuContent align="start" className="w-auto min-w-56" onClick={stopPropagation}>
							<DropdownMenuRadioGroup value={shown} onValueChange={handleFormatChange}>
								{formats.map((item: ColorPickerFormat): React.JSX.Element => (
									<DropdownMenuRadioItem key={item} value={item} closeOnClick>
										<span className="w-12 shrink-0 font-medium">{labels.formatNames[item]}</span>
										<span className="truncate text-xs text-muted-foreground tabular-nums">{formatColor(context.display, item).replace(FUNCTION_WRAPPER_PATTERN, "")}</span>
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
			) : null}
			<div className="flex min-w-0 flex-1 self-stretch">
				{fields.channels.map((channel: ColorFieldChannel, index: number): React.JSX.Element => (
					<React.Fragment key={`${shown}-${channel}`}>
						{hasMenu || index > 0 ? <Separator orientation="vertical" aria-hidden="true" /> : null}
						<ColorPickerChannelInput channel={channel} colorSpace={fields.space} />
					</React.Fragment>
				))}
				{/* Opacity keeps its own width at the end: hex, or the channels, take the rest of the row. */}
				{context.alpha ? (
					<>
						<Separator orientation="vertical" aria-hidden="true" />
						<ColorPickerChannelInput channel="alpha" className="w-[calc(4.8ch+0.75rem)] flex-none" />
					</>
				) : null}
			</div>
		</InputGroup>
	);
});

export { ColorPickerChannelInput, ColorPickerFields };
