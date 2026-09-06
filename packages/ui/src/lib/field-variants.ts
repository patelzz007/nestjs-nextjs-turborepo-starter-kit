import { cva } from "class-variance-authority";
import { z } from "zod";

/** Shared CVA `state` variants for text inputs, textareas, and similar controls. */
export const fieldStateVariants: { readonly state: Record<string, string> } = {
	state: {
		default: "",
		loading: "pointer-events-none opacity-60",
		disabled: "pointer-events-none cursor-not-allowed opacity-50",
		error:
			"border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
	},
};

const inputBaseClasses =
	"w-full min-w-0 rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export const inputVariants = cva(inputBaseClasses, {
	variants: {
		variant: {
			default: "",
		},
		size: {
			default: "h-9 px-2.5 py-1 text-base file:h-7 file:text-sm md:text-sm",
			sm: "h-8 px-2 text-sm file:h-6 file:text-xs",
			lg: "h-10 px-3 py-2 text-base file:h-8 md:text-sm",
		},
		state: fieldStateVariants.state,
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

export const textareaVariants = cva(
	"flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
	{
		variants: {
			variant: {
				default: "",
			},
			size: {
				default: "min-h-16 text-base md:text-sm",
				sm: "min-h-12 text-sm",
				lg: "min-h-24 text-base md:text-sm",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			state: "default",
		},
	},
);

export const checkboxVariants = cva(
	"peer relative flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-input shadow-xs transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
	{
		variants: {
			variant: {
				default: "",
			},
			size: {
				default: "size-4",
				sm: "size-3.5",
				lg: "size-5",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			state: "default",
		},
	},
);

export const switchVariants = cva(
	"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "",
			},
			size: {
				default: "h-[var(--switch-height)] w-[var(--switch-width)]",
				sm: "h-[var(--switch-height-sm)] w-[var(--switch-width-sm)]",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			state: "default",
		},
	},
);

const selectTriggerBaseClasses =
	"group/select-trigger flex items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const selectTriggerVariants = cva(selectTriggerBaseClasses, {
	variants: {
		variant: {
			default: "",
		},
		size: {
			sm: "h-8",
			default: "h-9",
			lg: "h-10",
		},
		state: fieldStateVariants.state,
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

export const comboboxInputGroupVariants = cva("w-auto", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			sm: "h-8",
			default: "h-9",
			lg: "h-10",
		},
		state: fieldStateVariants.state,
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

export const sliderVariants = cva("data-horizontal:w-full data-vertical:h-full", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			default: "",
			sm: "[&_[data-slot=slider-thumb]]:size-3 data-horizontal:[&_[data-slot=slider-track]]:h-1 data-vertical:[&_[data-slot=slider-track]]:w-1",
			lg: "[&_[data-slot=slider-thumb]]:size-5 data-horizontal:[&_[data-slot=slider-track]]:h-2 data-vertical:[&_[data-slot=slider-track]]:w-2",
		},
		state: {
			default: "",
			loading: "pointer-events-none opacity-60",
			disabled: "pointer-events-none opacity-50",
			error: "rounded-md ring-2 ring-destructive/30",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

/** Shared list-row density for Select, Combobox, and menu surfaces. */
export const listItemSizeSchema = z.enum(["sm", "default", "lg"]);

export type ListItemSize = z.output<typeof listItemSizeSchema>;

export const collectionItemDensityVariants = cva("", {
	variants: {
		size: {
			sm: "min-h-8 py-1.5 ps-2 pe-8",
			default: "min-h-9 py-2 ps-2.5 pe-8",
			lg: "min-h-10 py-2.5 ps-3 pe-8",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

/** Density classes for Select / Combobox option rows. */
export function resolveCollectionItemDensityClasses(size: ListItemSize): string {
	return collectionItemDensityVariants({ size });
}

/** Density classes for standard menu / command rows. */
export const menuItemDensityClasses = "min-h-9 px-2.5 py-2";

/** Density classes for menu rows with a trailing check indicator. */
export const menuItemIndicatorDensityClasses = "min-h-9 py-2 ps-2.5 pe-8";

/** Density classes for menu rows with a leading check indicator (menubar). */
export const menuItemLeadingIndicatorDensityClasses = "min-h-9 py-2 ps-8 pe-2.5";

/** Active surface colors for highlighted / selected collection rows (Select, Combobox). */
export const collectionItemActiveSurfaceClasses =
	"bg-slate-800 text-white [&_svg]:text-white [&_.text-muted-foreground]:text-white/80 dark:bg-white dark:text-slate-800 dark:[&_svg]:text-slate-800 dark:[&_.text-muted-foreground]:text-slate-800/80";

/** Active surface for destructive collection rows. */
export const collectionItemDestructiveActiveSurfaceClasses = "bg-destructive/10 text-destructive";

/** Active surface colors for focused / checked menu rows. */
export const menuItemActiveSurfaceClasses = "bg-slate-800 text-white [&_svg]:text-white dark:bg-white dark:text-slate-800 dark:[&_svg]:text-slate-800";

/** Active surface for destructive menu rows. */
export const menuItemDestructiveActiveSurfaceClasses = "bg-destructive/10 text-destructive";

export interface CollectionItemActiveState {
	readonly selected: boolean;
	readonly highlighted: boolean;
}

export interface MenuItemActiveState {
	readonly highlighted: boolean;
	readonly checked?: boolean;
}

/** Applies the active surface when a select/combobox row is selected or keyboard-highlighted. */
export function resolveCollectionItemActiveClasses(state: CollectionItemActiveState, variant: "default" | "destructive" = "default"): string {
	if (!state.selected && !state.highlighted) {
		return "";
	}
	if (variant === "destructive") {
		return collectionItemDestructiveActiveSurfaceClasses;
	}
	return collectionItemActiveSurfaceClasses;
}

/** Applies the active surface when a menu row is focused, highlighted, or checked. */
export function resolveMenuItemActiveClasses(state: MenuItemActiveState, variant: "default" | "destructive" = "default"): string {
	const isActive = state.highlighted || state.checked === true;
	if (!isActive) {
		return "";
	}
	if (variant === "destructive") {
		return menuItemDestructiveActiveSurfaceClasses;
	}
	return menuItemActiveSurfaceClasses;
}

/** Open submenu trigger state in menus. */
export const menuItemOpenClasses =
	"data-popup-open:bg-slate-800 data-popup-open:text-white data-popup-open:**:text-white data-open:bg-slate-800 data-open:text-white data-open:**:text-white dark:data-popup-open:bg-white dark:data-popup-open:text-slate-800 dark:data-popup-open:**:text-slate-800 dark:data-open:bg-white dark:data-open:text-slate-800 dark:data-open:**:text-slate-800";
