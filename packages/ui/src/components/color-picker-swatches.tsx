"use client";

import { isStringPrimitive } from "@workspace/shared";
import { copyOnShortcut, swatchBackground, useColorPickerContext, type ColorPickerSwatchInput } from "@workspace/ui/components/color-picker-context";
import { formatColor, getForegroundColor } from "@workspace/ui/lib/color/color-format";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import type { ColorPickerColor } from "@workspace/ui/lib/color/color-space";
import { cn } from "@workspace/ui/lib/core/utils";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cva } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import * as React from "react";

type SwatchShape = "square" | "circle";

interface SwatchesContextValue {
	readonly shape: SwatchShape;
	readonly activeId: string | null;
	readonly setActiveId: (id: string | null) => void;
}

function ignoreActiveId(): void {
	return;
}

const SwatchesContext = React.createContext<SwatchesContextValue>({ shape: "square", activeId: null, setActiveId: ignoreActiveId });

const OPTION_SELECTOR = '[data-slot="color-picker-swatch-item"]:not([aria-disabled="true"])';
const NAVIGATION_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/* Arrows move to the previous or next swatch in order, mirrored right to left, and Home and End to the ends. */
function neighbor(options: readonly HTMLElement[], current: HTMLElement | undefined, key: string, isRtl: boolean): HTMLElement | undefined {
	if (key === "Home") {
		return options.at(0);
	}
	if (key === "End") {
		return options.at(-1);
	}
	if (current === undefined) {
		return options.at(0);
	}
	const isForward = key === "ArrowDown" || key === (isRtl ? "ArrowLeft" : "ArrowRight");
	const next = options.indexOf(current) + (isForward ? 1 : -1);
	return next < 0 ? undefined : options.at(next);
}

interface KeyedSwatch {
	readonly key: string;
	readonly value: string;
	readonly label: string | undefined;
}

/** Normalises the presets and keys each one by its colour and occurrence, so a colour listed twice stays unique. */
function keySwatches(colors: readonly ColorPickerSwatchInput[]): KeyedSwatch[] {
	const seen = new Map<string, number>();
	return colors.map((item: ColorPickerSwatchInput): KeyedSwatch => {
		const swatch = isStringPrimitive(item) ? { value: item, label: undefined } : { value: item.value, label: item.label };
		const occurrence = (seen.get(swatch.value) ?? 0) + 1;
		seen.set(swatch.value, occurrence);
		return { key: `${swatch.value}-${String(occurrence)}`, value: swatch.value, label: swatch.label };
	});
}

/** The listbox: a `state` axis dims it while disabled. */
const colorPickerSwatchesVariants = cva(
	"group/color-picker-swatches grid grid-cols-[repeat(auto-fill,var(--color-picker-swatch-size))] justify-between gap-x-1 gap-y-1.5 outline-none [--color-picker-swatch-size:calc(var(--spacing)*6)] data-empty:focus-visible:outline-2 data-empty:focus-visible:outline-offset-2 data-empty:focus-visible:outline-ring",
	{
		variants: {
			state: {
				default: "",
				loading: "pointer-events-none opacity-80",
				disabled: "opacity-50",
				error: "",
			},
		},
		defaultVariants: { state: "default" },
	},
);

export type ColorPickerSwatchesProps = Omit<React.ComponentProps<"div">, "children" | "ref"> & {
	readonly colors?: readonly ColorPickerSwatchInput[] | undefined;
	readonly shape?: SwatchShape | undefined;
	readonly children?: React.ReactNode;
};

/**
 * Preset colours as a listbox: one tab stop, arrow keys move through them in
 * order, Enter or Space picks. `--color-picker-swatch-size` sets the chip size.
 */
const ColorPickerSwatches = React.forwardRef<HTMLDivElement, ColorPickerSwatchesProps>(function ColorPickerSwatches(
	{ colors, shape = "square", className, children, onKeyDown, onFocus, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerSwatches");
	const [activeId, setActiveId] = React.useState<string | null>(null);
	const listRef = React.useRef<HTMLDivElement | null>(null);
	const handleRef = React.useMemo(() => mergeRefs<HTMLDivElement>(listRef, ref), [ref]);
	const keyedSwatches = React.useMemo((): readonly KeyedSwatch[] => keySwatches(colors ?? []), [colors]);
	const swatchesContext = React.useMemo((): SwatchesContextValue => ({ shape, activeId, setActiveId }), [activeId, shape]);

	const handleFocus = React.useCallback(
		(event: React.FocusEvent<HTMLDivElement>): void => {
			onFocus?.(event);
			if (event.target !== event.currentTarget) {
				return;
			}
			const found = activeId === null ? null : event.currentTarget.ownerDocument.getElementById(activeId);
			if (found === null) {
				const selected = event.currentTarget.querySelector<HTMLElement>(`${OPTION_SELECTOR}[aria-selected="true"]`);
				setActiveId(selected?.id ?? null);
			}
		},
		[activeId, onFocus],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || copyOnShortcut(event, context) || context.disabled) {
				return;
			}
			const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>(OPTION_SELECTOR) ?? []);
			const current = options.find((option: HTMLElement): boolean => option.id === activeId);
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				current?.click();
				return;
			}
			if (!NAVIGATION_KEYS.has(event.key)) {
				return;
			}
			event.preventDefault();
			const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";
			const next = neighbor(options, current, event.key, isRtl) ?? current;
			if (next === undefined) {
				return;
			}
			setActiveId(next.id);
			next.scrollIntoView({ block: "nearest" });
		},
		[activeId, context, onKeyDown],
	);

	return (
		<SwatchesContext.Provider value={swatchesContext}>
			<div
				ref={handleRef}
				role="listbox"
				tabIndex={context.disabled ? -1 : 0}
				aria-label={context.i18n.labels.swatches}
				aria-activedescendant={activeId ?? undefined}
				aria-disabled={context.disabled ? true : undefined}
				aria-readonly={context.readOnly ? true : undefined}
				data-slot="color-picker-swatches"
				data-empty={activeId === null ? "" : undefined}
				className={cn(colorPickerSwatchesVariants({ state: context.state }), className)}
				onFocus={handleFocus}
				onKeyDown={handleKeyDown}
				{...props}>
				{children ?? keyedSwatches.map((swatch: KeyedSwatch): React.JSX.Element => <ColorPickerSwatchItem key={swatch.key} value={swatch.value} label={swatch.label} />)}
			</div>
		</SwatchesContext.Provider>
	);
});

/* The keyboard ring is an offset outline, so it never sits on the colour. */
const colorPickerSwatchItemVariants = cva(
	"relative flex size-(--color-picker-swatch-size) shrink-0 cursor-default items-center justify-center outline-offset-2 transition-[scale] duration-150 forced-color-adjust-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/10 not-aria-disabled:hover:scale-110 motion-reduce:transition-none group-focus-visible/color-picker-swatches:data-active:outline-2 group-focus-visible/color-picker-swatches:data-active:outline-ring [&_svg]:size-3.5",
	{
		variants: {
			shape: { square: "rounded-sm", circle: "rounded-full" },
			state: {
				default: "",
				loading: "",
				disabled: "opacity-40",
				error: "",
			},
		},
		defaultVariants: { shape: "square", state: "default" },
	},
);

/** The check on a selected swatch reads like text on it: pure white or black, chosen by contrast. */
const CHECK_LIGHT = "#fff";
const CHECK_DARK = "#000";

export type ColorPickerSwatchItemProps = Omit<React.ComponentProps<"div">, "children" | "ref"> & {
	/** Any colour `parseColor` reads. */
	readonly value: string;
	/** Read out instead of the generated colour name. */
	readonly label?: string | undefined;
	readonly disabled?: boolean | undefined;
};

/** One preset. Selected while the picker's value is this colour. */
const ColorPickerSwatchItem = React.forwardRef<HTMLDivElement, ColorPickerSwatchItemProps>(function ColorPickerSwatchItem(
	{ value, label, disabled = false, className, style, onClick, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerSwatchItem");
	const swatches = React.useContext(SwatchesContext);
	const id = React.useId();
	const isAlpha = context.alpha;
	const color = React.useMemo((): ColorPickerColor | null => {
		const parsed = parseColor(value);
		return parsed !== null && !isAlpha ? { ...parsed, alpha: 1 } : parsed;
	}, [isAlpha, value]);
	const isSelected = color !== null && context.color !== null && formatColor(color, "hex") === formatColor(context.color, "hex");
	const check = color === null ? CHECK_DARK : (getForegroundColor(color, { light: CHECK_LIGHT, dark: CHECK_DARK }) ?? CHECK_DARK);
	const isInactive = disabled || color === null;
	const { change, editable } = context;
	const { setActiveId } = swatches;
	const itemStyle = React.useMemo((): React.CSSProperties => ({ background: swatchBackground(color), color: check, ...style }), [check, color, style]);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			onClick?.(event);
			if (event.defaultPrevented || isInactive || !editable) {
				return;
			}
			setActiveId(id);
			change(color);
		},
		[change, color, editable, id, isInactive, onClick, setActiveId],
	);

	return (
		<div
			ref={ref}
			id={id}
			role="option"
			tabIndex={-1}
			aria-selected={isSelected}
			aria-disabled={isInactive ? true : undefined}
			aria-label={label ?? (color === null ? value : context.i18n.functions.getColorName(color))}
			data-slot="color-picker-swatch-item"
			data-active={swatches.activeId === id ? "" : undefined}
			data-selected={isSelected ? "" : undefined}
			className={cn(colorPickerSwatchItemVariants({ shape: swatches.shape, state: isInactive ? "disabled" : "default" }), className)}
			style={itemStyle}
			onClick={handleClick}
			{...props}>
			{isSelected ? <CheckIcon aria-hidden="true" /> : null}
		</div>
	);
});

export { ColorPickerSwatches, ColorPickerSwatchItem };
