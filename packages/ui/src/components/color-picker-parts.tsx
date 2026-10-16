"use client";

import type { BaseUIEvent } from "@base-ui/react/types";
import { hasGlobalValue } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import {
	ColorPickerContext,
	ColorPickerSurfaceContext,
	copyOnShortcut,
	swatchBackground,
	useColorPickerContext,
	useEscapeRevert,
} from "@workspace/ui/components/color-picker-context";
import { ColorPickerCopy, ColorPickerArea, ColorPickerEyeDropper, ColorPickerSlider } from "@workspace/ui/components/color-picker-controls";
import { ColorPickerFields } from "@workspace/ui/components/color-picker-fields";
import { ColorPickerSwatches } from "@workspace/ui/components/color-picker-swatches";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import type { ColorPickerColor } from "@workspace/ui/lib/color/color-space";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { flushSync } from "react-dom";

/* -------------------------------- Swatch -------------------------------- */

/** A colour chip. The inset ring keeps a white swatch visible on a white surface. */
const colorPickerSwatchVariants = cva(
	"relative inline-flex size-4 shrink-0 forced-color-adjust-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/10",
	{
		variants: {
			shape: {
				square: "rounded-sm",
				circle: "rounded-full",
			},
		},
		defaultVariants: { shape: "square" },
	},
);

export type ColorPickerSwatchProps = Omit<React.ComponentProps<"span">, "color" | "ref"> &
	VariantProps<typeof colorPickerSwatchVariants> & {
		/** The colour to show. Defaults to the picker's value, so it also works outside one. */
		readonly color?: string | null | undefined;
	};

/** A colour chip: the value in a trigger, or any colour in a table or a legend. */
const ColorPickerSwatch = React.forwardRef<HTMLSpanElement, ColorPickerSwatchProps>(function ColorPickerSwatch(
	{ color: colorProp, shape, className, style, ...props },
	ref,
): React.JSX.Element {
	const context = React.useContext(ColorPickerContext);
	const color = colorProp === undefined ? (context?.color ?? null) : parseColor(colorProp);
	const isLabelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
	const swatchStyle = React.useMemo((): React.CSSProperties => ({ background: swatchBackground(color), ...style }), [color, style]);
	return (
		<span
			ref={ref}
			role={isLabelled ? "img" : undefined}
			aria-hidden={isLabelled ? undefined : true}
			data-slot="color-picker-swatch"
			data-empty={color === null ? "" : undefined}
			className={cn(colorPickerSwatchVariants({ shape }), className)}
			style={swatchStyle}
			{...props}
		/>
	);
});

/* -------------------------------- Value -------------------------------- */

export type ColorPickerValueProps = Omit<React.ComponentProps<"span">, "children" | "ref"> & {
	readonly placeholder?: React.ReactNode;
};

/** The value as text, or the placeholder. For custom trigger content. */
const ColorPickerValue = React.forwardRef<HTMLSpanElement, ColorPickerValueProps>(function ColorPickerValue({ placeholder, className, ...props }, ref): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerValue");
	return (
		<span ref={ref} data-slot="color-picker-value" data-placeholder={context.color === null ? "" : undefined} className={cn("truncate", className)} {...props}>
			{context.text ?? placeholder ?? context.i18n.labels.placeholder}
		</span>
	);
});

/* -------------------------------- Trigger -------------------------------- */

/** The trigger reads as a field, not an action; its `state` axis follows the picker's. */
const colorPickerTriggerVariants = cva("font-normal tracking-normal normal-case tabular-nums data-placeholder:text-muted-foreground", {
	variants: {
		state: {
			default: "",
			loading: "pointer-events-none opacity-80",
			disabled: "pointer-events-none opacity-50",
			error: "border-destructive",
		},
	},
	defaultVariants: { state: "default" },
});

export type ColorPickerTriggerProps = Omit<React.ComponentProps<typeof Button>, "ref" | "placeholder"> & {
	readonly placeholder?: React.ReactNode;
};

/** A kit Button that opens the picker. Children replace the swatch, value and chevron. */
const ColorPickerTrigger = React.forwardRef<HTMLButtonElement, ColorPickerTriggerProps>(function ColorPickerTrigger(
	{ className, variant = "outline", placeholder, children, onKeyDown, "aria-labelledby": ariaLabelledBy, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerTrigger");
	const labelledBy = ariaLabelledBy ?? context.labelledBy;
	const { registerFocusTarget } = context;
	const handleRef = React.useMemo(() => mergeRefs<HTMLButtonElement>(ref, registerFocusTarget), [ref, registerFocusTarget]);
	const handleKeyDown = React.useCallback(
		(event: BaseUIEvent<React.KeyboardEvent<HTMLButtonElement>>): void => {
			onKeyDown?.(event);
			if (!event.defaultPrevented) {
				copyOnShortcut(event, context);
			}
		},
		[context, onKeyDown],
	);
	const content =
		children === undefined ? (
			<>
				<ColorPickerSwatch data-icon="inline-start" />
				<ColorPickerValue placeholder={placeholder} className="flex-1 text-start" />
				<span data-icon="inline-end" aria-hidden="true" className="flex text-muted-foreground">
					<ChevronDownIcon aria-hidden="true" />
				</span>
			</>
		) : (
			children
		);

	return (
		<PopoverTrigger
			ref={handleRef}
			id={context.id}
			render={
				<Button
					variant={variant}
					disabled={context.disabled}
					aria-label={context.label}
					aria-describedby={context.describedBy}
					aria-invalid={context.invalid ? true : undefined}
					data-invalid={context.invalid ? "" : undefined}
					{...props}
					/* The label, then the button's own text: a label alone would replace the value. */
					aria-labelledby={labelledBy === undefined ? undefined : `${labelledBy} ${context.id}`}
					onKeyDown={handleKeyDown}
					id={context.id}
					data-slot="color-picker-trigger"
					data-placeholder={context.color === null ? "" : undefined}
					className={cn(colorPickerTriggerVariants({ state: context.state }), children === undefined ? "justify-start" : undefined, className)}
				/>
			}>
			{content}
		</PopoverTrigger>
	);
});

/* -------------------------------- Input -------------------------------- */

const CSS_WIDE_KEYWORD = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/u;
const PROBE_PARENT_FIRST_COLOR = "rgb(1, 2, 3)";
const PROBE_PARENT_SECOND_COLOR = "rgb(4, 5, 6)";

/*
 * Whatever else the browser paints (color-mix(), relative colours,
 * light-dark(), system colours), resolved by its computed style, which
 * serializes as a function parseColor reads. Two parents of different colours
 * expose anything that inherits. Only typing reaches this, never a render.
 */
function parseWithBrowser(text: string): ColorPickerColor | null {
	if (!hasGlobalValue("document") || !hasGlobalValue("CSS") || CSS_WIDE_KEYWORD.test(text.toLowerCase()) || !CSS.supports("color", text)) {
		return null;
	}
	const parent = document.createElement("div");
	const probe = document.createElement("div");
	parent.style.display = "none";
	probe.style.color = text;
	parent.append(probe);
	document.body.append(parent);
	parent.style.color = PROBE_PARENT_FIRST_COLOR;
	const first = getComputedStyle(probe).color;
	parent.style.color = PROBE_PARENT_SECOND_COLOR;
	const second = getComputedStyle(probe).color;
	parent.remove();
	return first === second ? parseColor(first) : null;
}

/** The typable field's group: a `state` axis dims it while disabled. */
const colorPickerInputVariants = cva("", {
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

export type ColorPickerInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "defaultValue" | "ref">;

/**
 * A typable field with a swatch button that opens the picker. It reads any
 * CSS colour the browser knows, named colours included, on blur and Enter;
 * Escape restores the value and Alt+ArrowDown opens the popover.
 */
const ColorPickerInput = React.forwardRef<HTMLInputElement, ColorPickerInputProps>(function ColorPickerInput(
	{ className, placeholder, onBlur, onKeyDown, onChange, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerInput");
	/* `null` while the field shows the value rather than an edit in progress. */
	const [text, setText] = React.useState<string | null>(null);
	const current = context.text ?? "";
	const shown = text ?? current;
	const fieldRef = React.useRef<HTMLInputElement | null>(null);
	const revert = React.useCallback((): void => {
		setText(null);
	}, []);
	useEscapeRevert(fieldRef, text !== null, revert);
	const { change, setOpen, registerFocusTarget } = context;
	const handleRef = React.useMemo(() => mergeRefs<HTMLInputElement>(fieldRef, registerFocusTarget, ref), [ref, registerFocusTarget]);

	const read = React.useCallback((): void => {
		if (text === null) {
			return;
		}
		setText(null);
		if (text === current) {
			return;
		}
		if (text.trim().length === 0) {
			change(null);
			return;
		}
		const typed = parseColor(text) ?? parseWithBrowser(text.trim());
		if (typed !== null) {
			change(typed);
		}
	}, [change, current, text]);

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
			if (event.key === "Enter") {
				/* Flushed, so an implicit form submit reads the new value. */
				flushSync(read);
			} else if (event.altKey && event.key === "ArrowDown") {
				event.preventDefault();
				read();
				setOpen(true);
			}
		},
		[context, onKeyDown, read, setOpen],
	);

	return (
		<InputGroup data-slot="color-picker-input" data-disabled={context.disabled ? "" : undefined} className={cn(colorPickerInputVariants({ state: context.state }), className)}>
			<InputGroupAddon align="inline-start">
				<PopoverTrigger
					render={<InputGroupButton size="icon-xs" disabled={context.disabled} aria-label={context.i18n.labels.openPicker} data-slot="color-picker-input-trigger" />}>
					<ColorPickerSwatch />
				</PopoverTrigger>
			</InputGroupAddon>
			<InputGroupInput
				value={shown}
				placeholder={placeholder ?? context.i18n.labels.placeholder}
				disabled={context.disabled}
				readOnly={context.readOnly}
				required={context.required}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				aria-keyshortcuts="Alt+ArrowDown"
				aria-label={context.label}
				aria-labelledby={context.labelledBy}
				aria-describedby={context.describedBy}
				aria-invalid={context.invalid ? true : undefined}
				className="tabular-nums"
				onChange={handleChange}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				{...props}
				id={context.id}
				ref={handleRef}
			/>
		</InputGroup>
	);
});

/* -------------------------------- Content -------------------------------- */

const TABBABLE_SELECTOR = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export type ColorPickerContentProps = Omit<React.ComponentProps<typeof PopoverContent>, "ref">;

/**
 * The popover: the default panel unless given children. Tab cycles inside it,
 * as in a date picker dialog.
 */
const ColorPickerContent = React.forwardRef<HTMLDivElement, ColorPickerContentProps>(function ColorPickerContent(
	{ className, align = "start", onKeyDown, children, ...props },
	ref,
): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerContent");
	const handleKeyDown = React.useCallback(
		(event: BaseUIEvent<React.KeyboardEvent<HTMLDivElement>>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR));
			const active = event.currentTarget.ownerDocument.activeElement;
			const first = items.at(0);
			const last = items.at(-1);
			if (!event.shiftKey && active === last) {
				event.preventDefault();
				first?.focus();
			} else if (event.shiftKey && active === first) {
				event.preventDefault();
				last?.focus();
			}
		},
		[onKeyDown],
	);
	return (
		<PopoverContent
			ref={ref}
			align={align}
			aria-labelledby={context.labelledBy}
			aria-label={context.labelledBy === undefined ? (context.label ?? context.i18n.labels.panelLabel) : undefined}
			/* OKLCH with opacity needs the extra width for its four fields. A variable, not md:w-*, so one plain w-* in className wins. */
			className={cn(
				"w-(--color-picker-content-width) max-w-[calc(100vw-1rem)]",
				context.alpha ? "[--color-picker-content-width:--spacing(96)] md:[--color-picker-content-width:--spacing(84)]" : "[--color-picker-content-width:--spacing(72)]",
				className,
			)}
			onKeyDown={handleKeyDown}
			{...props}>
			<ColorPickerSurfaceContext.Provider value="popup">{children === undefined ? <ColorPickerPanel /> : children}</ColorPickerSurfaceContext.Provider>
		</PopoverContent>
	);
});

/* -------------------------------- Panel -------------------------------- */

/** The area, sliders and fields read as one control: a step tighter than the popover gap. */
const colorPickerPanelVariants = cva("flex w-full min-w-0 flex-col gap-3", {
	variants: {
		state: {
			default: "",
			loading: "pointer-events-none opacity-80",
			disabled: "",
			error: "",
		},
	},
	defaultVariants: { state: "default" },
});

export type ColorPickerPanelProps = Omit<React.ComponentProps<"div">, "ref">;

/**
 * The area, the sliders, the fields and any `swatches`, rendered in place:
 * put it straight inside a `ColorPicker` for an always-open picker.
 */
const ColorPickerPanel = React.forwardRef<HTMLDivElement, ColorPickerPanelProps>(function ColorPickerPanel({ className, children, ...props }, ref): React.JSX.Element {
	const context = useColorPickerContext("ColorPickerPanel");
	const isInline = React.useContext(ColorPickerSurfaceContext) === "inline";
	const swatches = context.swatches ?? [];
	return (
		<div
			ref={ref}
			role={isInline ? "group" : undefined}
			aria-labelledby={isInline ? context.labelledBy : undefined}
			aria-label={isInline && context.labelledBy === undefined ? (context.label ?? context.i18n.labels.panelLabel) : undefined}
			data-slot="color-picker-panel"
			data-disabled={context.disabled ? "" : undefined}
			className={cn(colorPickerPanelVariants({ state: context.state }), className)}
			{...props}>
			{children === undefined ? (
				<>
					<ColorPickerArea />
					<div className="flex items-center gap-3">
						<ColorPickerEyeDropper />
						<div className="flex min-w-0 flex-1 flex-col gap-2.5">
							<ColorPickerSlider channel="hue" />
							{context.alpha ? <ColorPickerSlider channel="alpha" /> : null}
						</div>
						<ColorPickerCopy />
					</div>
					<ColorPickerFields />
					{swatches.length > 0 ? <ColorPickerSwatches colors={swatches} /> : null}
				</>
			) : (
				children
			)}
		</div>
	);
});

export {
	ColorPickerContent,
	ColorPickerInput,
	ColorPickerPanel,
	ColorPickerSwatch,
	ColorPickerTrigger,
	ColorPickerValue,
	colorPickerSwatchVariants,
	colorPickerTriggerVariants,
};
