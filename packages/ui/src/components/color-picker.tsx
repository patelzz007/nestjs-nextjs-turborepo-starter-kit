"use client";

import { hasGlobalValue } from "@workspace/shared";
import {
	ColorPickerContext,
	EMPTY_COLOR,
	type ColorPickerContextValue,
	type ColorPickerFunctions,
	type ColorPickerI18nConfig,
	type ColorPickerI18nOverrides,
	type ColorPickerSwatchInput,
} from "@workspace/ui/components/color-picker-context";
import { ColorPickerContent, ColorPickerTrigger } from "@workspace/ui/components/color-picker-parts";
import { Popover } from "@workspace/ui/components/popover";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { formatColor } from "@workspace/ui/lib/color/color-format";
import { describeColor } from "@workspace/ui/lib/color/color-name";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import type { ColorPickerColor, ColorPickerFormat } from "@workspace/ui/lib/color/color-space";
import { assignRef, mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import * as React from "react";
import { z } from "zod";

/** How long a copy button shows its confirmation. */
const COPIED_CONFIRMATION_MS = 1500;

export interface ColorPickerProps extends Readonly<Pick<React.AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby">> {
	/** Controlled value: any colour `parseColor` reads. `null` is empty. */
	readonly value?: string | null | undefined;
	readonly defaultValue?: string | null | undefined;
	/** Fires on every change, a drag included, with the value in `format`. */
	readonly onValueChange?: ((value: string | null) => void) | undefined;
	/** Fires once an interaction ends: a drag released, a key, a field, a swatch. */
	readonly onValueCommit?: ((value: string | null) => void) | undefined;
	/** How the value is written. */
	readonly format?: ColorPickerFormat | undefined;
	/** Adds the opacity slider and field, and lets the value carry alpha. */
	readonly alpha?: boolean | undefined;
	/** Preset colours under the default panel. */
	readonly swatches?: readonly ColorPickerSwatchInput[] | undefined;
	readonly open?: boolean | undefined;
	readonly defaultOpen?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	readonly disabled?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** Submits the value with a native form under this name. */
	readonly name?: string | undefined;
	readonly form?: string | undefined;
	readonly required?: boolean | undefined;
	/** The hidden form field, for form libraries that focus a field on error. */
	readonly inputRef?: React.Ref<HTMLInputElement> | undefined;
	/** Lands on the trigger or the input. */
	readonly id?: string | undefined;
	/** Per-usage copy (laid over the `colorPicker` labels of `UiKitLabelsProvider`) and the colour-naming function. */
	readonly i18n?: ColorPickerI18nOverrides | undefined;
	/** Without children the picker renders a trigger and a popover; these reach the trigger. */
	readonly placeholder?: React.ReactNode;
	readonly className?: string | undefined;
	readonly children?: React.ReactNode;
}

interface HeldColor {
	readonly value: string | null;
	readonly color: ColorPickerColor | null;
}

interface LatestColor {
	readonly value: string | null;
	readonly color: ColorPickerColor;
}

function emptyToNull(value: string | null | undefined): string | null {
	return value === undefined || value === null || value.length === 0 ? null : value;
}

function withoutAlpha(color: ColorPickerColor): ColorPickerColor {
	return color.alpha === 1 ? color : { ...color, alpha: 1 };
}

/* The hidden form field is written by the picker, not typed into. */
function ignoreNativeChange(): void {
	return;
}

/** The async clipboard, checked structurally: insecure contexts and test DOMs have none. */
const ClipboardSchema = z.custom<Pick<Clipboard, "writeText">>((value): boolean => z.object({ writeText: z.function() }).safeParse(value).success);

function readClipboard(): Pick<Clipboard, "writeText"> | null {
	if (!hasGlobalValue("navigator")) {
		return null;
	}
	const parsed = ClipboardSchema.safeParse(Reflect.get(navigator, "clipboard"));
	return parsed.success ? parsed.data : null;
}

/* No clipboard permission: nothing was copied, nothing to confirm. */
function ignoreCopyFailure(): void {
	return;
}

/**
 * A colour picker: a saturation area, hue / alpha / channel sliders, a hue
 * wheel, HEX / RGB / HSL / HSB / OKLCH fields, swatches and an eye dropper.
 * Without children it renders a trigger button and a popover with the
 * default panel; compose the parts for anything else. The ref reaches the
 * focusable control — the trigger, or a `ColorPickerInput`.
 */
const ColorPicker = React.forwardRef<HTMLElement, ColorPickerProps>(function ColorPicker(
	{
		value,
		defaultValue = null,
		onValueChange,
		onValueCommit,
		format = "hex",
		alpha = false,
		swatches,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		disabled = false,
		readOnly = false,
		invalid = false,
		name,
		form,
		required = false,
		inputRef,
		id: idProp,
		"aria-label": label,
		"aria-labelledby": labelledBy,
		"aria-describedby": describedBy,
		i18n: i18nProp,
		placeholder,
		className,
		children,
	},
	ref,
): React.JSX.Element {
	const generatedId = React.useId();
	const id = idProp ?? generatedId;
	const [uncontrolled, setUncontrolled] = React.useState<string | null>(defaultValue);
	/* What a form reset restores, as a native field returns to its default. */
	const [initialValue] = React.useState<string | null>(defaultValue);
	const [openState, setOpenState] = React.useState(defaultOpen);
	const open = openProp ?? openState;
	const raw = emptyToNull(value === undefined ? uncontrolled : value);

	/* The channels behind the value, kept in the space they were edited in. A
	   value from outside is parsed afresh; one this picker emitted keeps its
	   channels, so the hue of a grey and an OKLCH chroma survive. */
	const [held, setHeld] = React.useState<HeldColor>(() => ({ value: raw, color: parseColor(raw) }));
	let heldColor = held.color;
	if (held.value !== raw) {
		heldColor = parseColor(raw);
		setHeld({ value: raw, color: heldColor });
	}
	const color = heldColor !== null && !alpha ? withoutAlpha(heldColor) : heldColor;
	const display = color ?? EMPTY_COLOR;

	const latest = React.useRef<LatestColor>({ value: raw, color: display });
	React.useLayoutEffect((): void => {
		latest.current = { value: raw, color: display };
	});
	const interaction = React.useRef<{ readonly from: string | null } | null>(null);
	const focusTarget = React.useRef<HTMLElement | null>(null);
	const fieldRef = React.useRef<HTMLInputElement | null>(null);

	const labels = useUiKitLabels("colorPicker", i18nProp?.labels);
	const getColorName = i18nProp?.functions?.getColorName;
	const i18n = React.useMemo((): ColorPickerI18nConfig => {
		const functions: ColorPickerFunctions = {
			getColorName: getColorName ?? ((named: ColorPickerColor): string => labels.colorName(describeColor(named))),
		};
		return { labels, functions };
	}, [getColorName, labels]);
	const editable = !disabled && !readOnly;
	const state = resolveFieldState({ disabled, ariaInvalid: invalid });

	const setOpen = React.useCallback(
		(next: boolean): void => {
			if (next && disabled) {
				return;
			}
			if (openProp === undefined) {
				setOpenState(next);
			}
			onOpenChange?.(next);
		},
		[disabled, onOpenChange, openProp],
	);

	const emit = React.useCallback(
		(next: ColorPickerColor | null): void => {
			if (!editable) {
				return;
			}
			const normalized = next !== null && !alpha ? withoutAlpha(next) : next;
			const nextValue = normalized === null ? null : formatColor(normalized, format);
			const previous = latest.current.value;
			const previousParsed = parseColor(previous);
			const canonicalPrevious = previousParsed === null ? null : formatColor(alpha ? previousParsed : withoutAlpha(previousParsed), format);
			/* The same colour written another way, `#FF0000` for `#ff0000`, keeps its string: no change is emitted that nobody made. */
			const isSame = nextValue === previous || nextValue === canonicalPrevious;
			const kept = isSame ? previous : nextValue;
			latest.current = { value: kept, color: normalized ?? EMPTY_COLOR };
			setHeld({ value: kept, color: normalized });
			if (isSame) {
				return;
			}
			if (value === undefined) {
				setUncontrolled(nextValue);
			}
			onValueChange?.(nextValue);
		},
		[alpha, editable, format, onValueChange, value],
	);

	const startInteraction = React.useCallback((): void => {
		interaction.current = { from: latest.current.value };
	}, []);

	const endInteraction = React.useCallback((): void => {
		const started = interaction.current;
		interaction.current = null;
		if (started !== null && started.from !== latest.current.value) {
			onValueCommit?.(latest.current.value);
		}
	}, [onValueCommit]);

	const change = React.useCallback(
		(next: ColorPickerColor | null): void => {
			startInteraction();
			emit(next);
			endInteraction();
		},
		[emit, endInteraction, startInteraction],
	);

	const registerFocusTarget = React.useCallback(
		(node: HTMLElement | null): void => {
			if (node !== null) {
				focusTarget.current = node;
			}
			assignRef(ref, node);
		},
		[ref],
	);

	const getColor = React.useCallback((): ColorPickerColor => latest.current.color, []);

	/* The fields report the format they show, so a copy takes what is seen. */
	const [fieldsFormat, setFieldsFormat] = React.useState<ColorPickerFormat | null>(null);
	const shownFormat = fieldsFormat ?? format;
	const [copied, setCopied] = React.useState<ColorPickerFormat | null>(null);
	const copiedTimer = React.useRef(0);
	React.useEffect(
		(): (() => void) => (): void => {
			window.clearTimeout(copiedTimer.current);
		},
		[],
	);

	const copy = React.useCallback(
		(to: ColorPickerFormat = shownFormat): void => {
			if (color === null) {
				return;
			}
			const clipboard = readClipboard();
			if (clipboard === null) {
				return;
			}
			const confirm = (): void => {
				setCopied(to);
				window.clearTimeout(copiedTimer.current);
				copiedTimer.current = window.setTimeout((): void => {
					setCopied(null);
				}, COPIED_CONFIRMATION_MS);
			};
			void clipboard.writeText(formatColor(color, to)).then(confirm, ignoreCopyFailure);
		},
		[color, shownFormat],
	);

	const text = React.useMemo((): string | null => {
		if (color === null) {
			return null;
		}
		const written = formatColor(color, format);
		return format === "hex" ? written.toUpperCase() : written;
	}, [color, format]);

	const context = React.useMemo(
		(): ColorPickerContextValue => ({
			id,
			value: raw,
			text,
			color,
			display,
			format,
			alpha,
			i18n,
			disabled,
			readOnly,
			editable,
			invalid,
			required,
			state,
			label,
			labelledBy,
			describedBy,
			swatches,
			open,
			setOpen,
			getColor,
			emit,
			startInteraction,
			endInteraction,
			change,
			registerFocusTarget,
			shownFormat,
			setFieldsFormat,
			copy,
			copied,
		}),
		[
			alpha,
			change,
			color,
			copied,
			copy,
			describedBy,
			disabled,
			display,
			editable,
			emit,
			endInteraction,
			format,
			getColor,
			i18n,
			id,
			invalid,
			label,
			labelledBy,
			open,
			raw,
			readOnly,
			registerFocusTarget,
			required,
			setOpen,
			shownFormat,
			startInteraction,
			state,
			swatches,
			text,
		],
	);

	/* Listens on the field's own root and asks for its form at reset time, so
	   a `form` attribute is honoured. The restore waits a task, like a native
	   reset's default action, because any listener may still cancel it. */
	const resetRef = React.useRef((): void => {
		return;
	});
	React.useEffect((): void => {
		resetRef.current = (): void => {
			change(parseColor(initialValue));
		};
	});
	const hasField = name !== undefined || required;
	React.useEffect((): (() => void) | undefined => {
		const root = fieldRef.current?.getRootNode();
		if (root === undefined) {
			return undefined;
		}
		let pending = 0;
		const handleReset = (event: Event): void => {
			if (event.target !== fieldRef.current?.form) {
				return;
			}
			pending = window.setTimeout((): void => {
				if (!event.defaultPrevented) {
					resetRef.current();
				}
			});
		};
		root.addEventListener("reset", handleReset, true);
		return (): void => {
			root.removeEventListener("reset", handleReset, true);
			window.clearTimeout(pending);
		};
	}, [hasField]);

	const handleFieldRef = React.useMemo(() => mergeRefs<HTMLInputElement>(fieldRef, inputRef), [inputRef]);

	/* A failed `required` check focuses the hidden field; hand that to the control. */
	const handleFieldFocus = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>): void => {
			const registered = focusTarget.current?.isConnected === true ? focusTarget.current : null;
			const target = registered ?? event.currentTarget.ownerDocument.getElementById(`${id}-area`);
			if (target === null) {
				event.currentTarget.blur();
				return;
			}
			target.focus();
		},
		[id],
	);

	return (
		<ColorPickerContext.Provider value={context}>
			<Popover open={open} onOpenChange={setOpen}>
				{children === undefined ? (
					<>
						<ColorPickerTrigger className={className} placeholder={placeholder} />
						<ColorPickerContent />
					</>
				) : (
					children
				)}
			</Popover>
			<span role="status" className="sr-only">
				{copied === null ? "" : labels.copied}
			</span>
			{hasField ? (
				<input
					ref={handleFieldRef}
					type="text"
					name={name}
					form={form}
					required={required ? !readOnly : false}
					disabled={disabled}
					value={color === null ? "" : formatColor(color, format)}
					onChange={ignoreNativeChange}
					tabIndex={-1}
					aria-hidden="true"
					data-slot="color-picker-field"
					onFocus={handleFieldFocus}
					className="pointer-events-none absolute size-px max-w-px opacity-0"
				/>
			) : null}
		</ColorPickerContext.Provider>
	);
});

export { ColorPicker };
export {
	useColorPicker,
	type ColorPickerApi,
	type ColorPickerFunctions,
	type ColorPickerI18nConfig,
	type ColorPickerI18nOverrides,
	type ColorPickerLabels,
	type ColorPickerSwatchInput,
} from "@workspace/ui/components/color-picker-context";
export {
	ColorPickerContent,
	ColorPickerInput,
	ColorPickerPanel,
	ColorPickerSwatch,
	ColorPickerTrigger,
	ColorPickerValue,
	type ColorPickerContentProps,
	type ColorPickerInputProps,
	type ColorPickerPanelProps,
	type ColorPickerSwatchProps,
	type ColorPickerTriggerProps,
	type ColorPickerValueProps,
} from "@workspace/ui/components/color-picker-parts";
export {
	ColorPickerArea,
	ColorPickerClear,
	ColorPickerCopy,
	ColorPickerEyeDropper,
	ColorPickerSlider,
	ColorPickerWheel,
	type ColorPickerActionProps,
	type ColorPickerAreaProps,
	type ColorPickerCopyProps,
	type ColorPickerSliderProps,
	type ColorPickerWheelProps,
} from "@workspace/ui/components/color-picker-controls";
export { ColorPickerChannelInput, ColorPickerFields, type ColorPickerChannelInputProps, type ColorPickerFieldsProps } from "@workspace/ui/components/color-picker-fields";
export { ColorPickerSwatches, ColorPickerSwatchItem, type ColorPickerSwatchesProps, type ColorPickerSwatchItemProps } from "@workspace/ui/components/color-picker-swatches";
export { COLOR_PICKER_FORMATS, formatColor, getContrastRatio, getForegroundColor } from "@workspace/ui/lib/color/color-format";
export { parseColor } from "@workspace/ui/lib/color/color-parse";
export { isColorInSrgb, type ColorPickerChannel, type ColorPickerColor, type ColorPickerColorSpace, type ColorPickerFormat } from "@workspace/ui/lib/color/color-space";
