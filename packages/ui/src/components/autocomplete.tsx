"use client";

// Ported from ReUI (https://reui.io/r/base-vega/autocomplete.json), a styled
// base-ui Autocomplete: a free-text input with a list of suggestions (unlike
// `Combobox`, the value is whatever the user typed). Part names, props
// (`size` / `showClear` / `showTrigger` on the input, `scrollAreaClassName` on
// the list, `showBackdrop` / `side` / `align` / offsets / `anchor` on the
// content) and `data-slot` attributes match ReUI, so its examples apply, with
// these deliberate deviations:
// - Every part that renders an element forwards its ref; `AutocompleteInput`'s
//   ref lands on the `<input>`.
// - Heights follow the kit's input scale (sm h-8 / default h-9 / lg h-10), and
//   `disabled` / `loading` / `aria-invalid` drive a CVA `state` axis.
// - Highlighted rows use the kit's collection surface (as `Combobox` does),
//   and the popup sits on the `z-popover` layer instead of `z-50`.
// - The icon-only clear and trigger buttons are named from the
//   `autocomplete` family of `UiKitLabelsProvider` (overridable with `aria-label`).
// - `AutocompleteList` drops ReUI's `scrollFade` / `scrollbarGutter`, which
//   ReUI declared but never used (they leaked onto the DOM).
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { fieldStateVariants } from "@workspace/ui/lib/form/field-variants";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";

/** Copy for the autocomplete's icon-only buttons — the `autocomplete` family of `UiKitLabels`. */
export interface AutocompleteLabels {
	/** Accessible name of the clear (x) button. */
	readonly clear: string;
	/** Accessible name of the button that opens the suggestions. */
	readonly showSuggestions: string;
}

/** The popup's distance from the input when `sideOffset` is omitted (px). */
const DEFAULT_SIDE_OFFSET = 4;

const autocompleteInputVariants = cva(
	"flex w-full rounded-md border border-input bg-transparent text-sm text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground read-only:cursor-not-allowed read-only:bg-muted/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
	{
		variants: {
			size: {
				sm: "h-8 px-2 [&~[data-slot=autocomplete-clear]]:end-1.5 [&~[data-slot=autocomplete-trigger]]:end-1.5",
				default: "h-9 px-2.5 [&~[data-slot=autocomplete-clear]]:end-2 [&~[data-slot=autocomplete-trigger]]:end-2",
				lg: "h-10 px-3 [&~[data-slot=autocomplete-clear]]:end-2.5 [&~[data-slot=autocomplete-trigger]]:end-2.5",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			size: "default",
			state: "default",
		},
	},
);

/** The root: owns the input value, the items and the open state. Renders no element. */
const Autocomplete = AutocompletePrimitive.Root;

/** The current input value as text. Renders no element of its own. */
function AutocompleteValue(props: AutocompletePrimitive.Value.Props): React.ReactElement {
	return <AutocompletePrimitive.Value {...props} />;
}

type AutocompleteTriggerProps = AutocompletePrimitive.Trigger.Props;

const AutocompleteTrigger = React.forwardRef<HTMLButtonElement, AutocompleteTriggerProps>(function AutocompleteTrigger({ className, ...props }, ref): React.JSX.Element {
	const labels = useUiKitLabels("autocomplete");
	return (
		<AutocompletePrimitive.Trigger
			ref={ref}
			data-slot="autocomplete-trigger"
			aria-label={labels.showSuggestions}
			className={cn(
				"absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none has-[+[data-slot=autocomplete-clear]]:hidden data-disabled:pointer-events-none",
				className,
			)}
			{...props}>
			<ChevronsUpDownIcon aria-hidden className="size-4 opacity-70" />
		</AutocompletePrimitive.Trigger>
	);
});

type AutocompleteClearProps = AutocompletePrimitive.Clear.Props;

const AutocompleteClear = React.forwardRef<HTMLButtonElement, AutocompleteClearProps>(function AutocompleteClear({ className, ...props }, ref): React.JSX.Element {
	const labels = useUiKitLabels("autocomplete");
	return (
		<AutocompletePrimitive.Clear
			ref={ref}
			data-slot="autocomplete-clear"
			aria-label={labels.clear}
			className={cn(
				"absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm opacity-70 transition-opacity outline-none hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none data-disabled:pointer-events-none",
				className,
			)}
			{...props}>
			<XIcon aria-hidden className="size-4" />
		</AutocompletePrimitive.Clear>
	);
});

type AutocompleteInputProps = Omit<AutocompletePrimitive.Input.Props, "size"> &
	Omit<VariantProps<typeof autocompleteInputVariants>, "state"> & {
		/** Render the clear (x) button inside the input. */
		readonly showClear?: boolean | undefined;
		/** Render the open-suggestions chevron inside the input. */
		readonly showTrigger?: boolean | undefined;
		/** Dim the input and block typing while suggestions load. */
		readonly loading?: boolean | undefined;
	};

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(function AutocompleteInput(
	{ className, size = "default", showClear = false, showTrigger = false, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });
	return (
		<div data-slot="autocomplete-input-wrapper" className="relative w-full">
			<AutocompletePrimitive.Input
				ref={ref}
				data-slot="autocomplete-input"
				data-size={size}
				data-loading={loading ? "" : undefined}
				disabled={disabled}
				aria-invalid={ariaInvalid}
				className={cn(autocompleteInputVariants({ size, state }), (showClear || showTrigger) && "pe-8", className)}
				{...props}
			/>
			{showTrigger ? <AutocompleteTrigger /> : null}
			{showClear ? <AutocompleteClear /> : null}
		</div>
	);
});

const AutocompleteStatus = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Status.Props>(function AutocompleteStatus({ className, ...props }, ref): React.JSX.Element {
	return (
		<AutocompletePrimitive.Status
			ref={ref}
			data-slot="autocomplete-status"
			className={cn("px-2 py-1.5 text-sm text-muted-foreground empty:m-0 empty:p-0", className)}
			{...props}
		/>
	);
});

const AutocompletePortal = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Portal.Props>(function AutocompletePortal(props, ref): React.JSX.Element {
	return <AutocompletePrimitive.Portal ref={ref} data-slot="autocomplete-portal" {...props} />;
});

const AutocompleteBackdrop = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Backdrop.Props>(function AutocompleteBackdrop(props, ref): React.JSX.Element {
	return <AutocompletePrimitive.Backdrop ref={ref} data-slot="autocomplete-backdrop" {...props} />;
});

const AutocompletePositioner = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Positioner.Props>(function AutocompletePositioner(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <AutocompletePrimitive.Positioner ref={ref} data-slot="autocomplete-positioner" className={cn("isolate z-popover outline-none", className)} {...props} />;
});

interface AutocompleteListProps extends AutocompletePrimitive.List.Props {
	/** Class name for the scroll area around the list. */
	readonly scrollAreaClassName?: string | undefined;
}

const AutocompleteList = React.forwardRef<HTMLDivElement, AutocompleteListProps>(function AutocompleteList(
	{ className, scrollAreaClassName, ...props },
	ref,
): React.JSX.Element {
	// Out of the layout while the list renders nothing. Base UI's scroll area
	// skips measuring 0px tall content, so a list that overflowed and then
	// filtered to empty kept its old thumb, hanging below the popup. Keyed on
	// :empty, not data-empty, which a list without `items` always carries.
	return (
		<ScrollArea
			className={cn(
				"size-full min-h-0 has-[[data-slot=autocomplete-list]:empty]:hidden **:data-[slot=scroll-area-viewport]:h-full **:data-[slot=scroll-area-viewport]:overscroll-contain",
				scrollAreaClassName,
			)}>
			<AutocompletePrimitive.List
				ref={ref}
				data-slot="autocomplete-list"
				className={cn("not-empty:scroll-py-1 not-empty:px-1 not-empty:py-1 in-data-has-overflow-y:me-3", className)}
				{...props}
			/>
		</ScrollArea>
	);
});

/** Renders the filtered items through a render function. Renders no element of its own. */
function AutocompleteCollection(props: AutocompletePrimitive.Collection.Props): React.JSX.Element {
	return <AutocompletePrimitive.Collection {...props} />;
}

const AutocompleteRow = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Row.Props>(function AutocompleteRow({ className, ...props }, ref): React.JSX.Element {
	return <AutocompletePrimitive.Row ref={ref} data-slot="autocomplete-row" className={cn("flex items-center gap-2", className)} {...props} />;
});

const AutocompleteItem = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Item.Props>(function AutocompleteItem({ className, ...props }, ref): React.JSX.Element {
	return (
		<AutocompletePrimitive.Item
			ref={ref}
			data-slot="autocomplete-item"
			className={cn(
				"relative flex min-h-9 cursor-default items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-foreground outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				// The kit's collection surface (`collectionItemActiveSurfaceClasses`), keyed on base-ui's highlight.
				"data-highlighted:bg-invert data-highlighted:text-invert-foreground data-highlighted:[&_.text-muted-foreground]:text-invert-foreground/80 data-highlighted:[&_svg]:text-invert-foreground",
				className,
			)}
			{...props}
		/>
	);
});

interface AutocompleteContentProps extends AutocompletePrimitive.Popup.Props {
	readonly align?: AutocompletePrimitive.Positioner.Props["align"];
	readonly sideOffset?: AutocompletePrimitive.Positioner.Props["sideOffset"];
	readonly alignOffset?: AutocompletePrimitive.Positioner.Props["alignOffset"];
	readonly side?: AutocompletePrimitive.Positioner.Props["side"];
	readonly anchor?: AutocompletePrimitive.Positioner.Props["anchor"];
	/** Render a backdrop behind the popup. */
	readonly showBackdrop?: boolean | undefined;
}

const AutocompleteContent = React.forwardRef<HTMLDivElement, AutocompleteContentProps>(function AutocompleteContent(
	{ className, children, showBackdrop = false, align = "start", sideOffset = DEFAULT_SIDE_OFFSET, alignOffset = 0, side = "bottom", anchor, ...props },
	ref,
): React.JSX.Element {
	return (
		<AutocompletePortal>
			{showBackdrop ? <AutocompleteBackdrop /> : null}
			<AutocompletePositioner align={align} sideOffset={sideOffset} alignOffset={alignOffset} side={side} anchor={anchor}>
				<div className="relative flex max-h-full">
					<AutocompletePrimitive.Popup
						ref={ref}
						data-slot="autocomplete-popup"
						className={cn(
							"flex max-h-[min(var(--available-height),24rem)] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) scroll-pt-2 scroll-pb-2 flex-col overscroll-contain rounded-md bg-popover py-0.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[scale,opacity] has-data-starting-style:scale-98 has-data-starting-style:opacity-0 has-data-[side=none]:scale-100 has-data-[side=none]:transition-none motion-reduce:transition-none",
							className,
						)}
						{...props}>
						{children}
					</AutocompletePrimitive.Popup>
				</div>
			</AutocompletePositioner>
		</AutocompletePortal>
	);
});

const AutocompleteGroup = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Group.Props>(function AutocompleteGroup(props, ref): React.JSX.Element {
	return <AutocompletePrimitive.Group ref={ref} data-slot="autocomplete-group" {...props} />;
});

const AutocompleteGroupLabel = React.forwardRef<HTMLDivElement, AutocompletePrimitive.GroupLabel.Props>(function AutocompleteGroupLabel(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<AutocompletePrimitive.GroupLabel
			ref={ref}
			data-slot="autocomplete-group-label"
			className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
			{...props}
		/>
	);
});

const AutocompleteEmpty = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Empty.Props>(function AutocompleteEmpty({ className, ...props }, ref): React.JSX.Element {
	return (
		<AutocompletePrimitive.Empty
			ref={ref}
			data-slot="autocomplete-empty"
			className={cn("px-2 py-1.5 text-center text-sm text-muted-foreground empty:m-0 empty:p-0", className)}
			{...props}
		/>
	);
});

const AutocompleteArrow = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Arrow.Props>(function AutocompleteArrow(props, ref): React.JSX.Element {
	return <AutocompletePrimitive.Arrow ref={ref} data-slot="autocomplete-arrow" {...props} />;
});

const AutocompleteSeparator = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Separator.Props>(function AutocompleteSeparator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <AutocompletePrimitive.Separator ref={ref} data-slot="autocomplete-separator" className={cn("my-1.5 h-px bg-border", className)} {...props} />;
});

export {
	Autocomplete,
	AutocompleteArrow,
	AutocompleteBackdrop,
	AutocompleteClear,
	AutocompleteCollection,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompletePortal,
	AutocompletePositioner,
	AutocompleteRow,
	AutocompleteSeparator,
	AutocompleteStatus,
	AutocompleteTrigger,
	AutocompleteValue,
	autocompleteInputVariants,
};
export type { AutocompleteClearProps, AutocompleteContentProps, AutocompleteInputProps, AutocompleteListProps, AutocompleteTriggerProps };
