import { cva } from "class-variance-authority";

/** Shared CVA `state` variants for text inputs, textareas, and similar controls. */
export const fieldStateVariants = {
	state: {
		default: "",
		loading: "pointer-events-none opacity-60",
		disabled: "pointer-events-none cursor-not-allowed opacity-50",
		error:
			"border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
	},
} as const;

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
