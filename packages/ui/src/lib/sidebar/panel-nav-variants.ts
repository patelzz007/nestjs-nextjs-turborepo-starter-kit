import { cva } from "class-variance-authority";

/** Panel sidebar nav row styles — shared by admin, web, and merchant. */
export const panelSidebarNavItemVariants = cva(
	"group flex h-auto min-h-0 w-full items-center justify-between gap-2 rounded-md px-3 py-2 font-[family-name:var(--font-sidebar)] text-sm font-normal tracking-[0.01em] transition-[background-color,color,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.99]",
	{
		variants: {
			state: {
				default: "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/40",
				// Fill + inset hairline from the `--sidebar-active*` tokens: a solid pill in light mode
				// (hairline = fill), a bordered wash in dark. The hairline is a box-shadow so the focus
				// ring — also a box-shadow layer — still composes on top of it.
				active:
					"bg-sidebar-active font-medium tracking-[0.01em] text-sidebar-active-foreground shadow-[inset_0_0_0_1px_var(--sidebar-active-border)] hover:bg-sidebar-active! hover:text-sidebar-active-foreground! focus-visible:ring-sidebar-ring",
				// Recedes by colour alone (no stacked opacity) — the trailing lock is the non-colour cue.
				disabled: "cursor-not-allowed text-sidebar-foreground/40",
			},
		},
		defaultVariants: {
			state: "default",
		},
	},
);

/** The lock that marks an unavailable row — decorative; the row's description announces it. */
export const panelSidebarNavUnavailableIconClassName = "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40";

/**
 * Row icons sit in a 24px tile (16px glyph + 4px padding) whose padding is cancelled by negative
 * margins, so every state keeps the same 16px footprint and activating a row never shifts its label.
 * Only the active row fills the tile (`--sidebar-primary`): in light mode it matches the pill, so
 * the pill reads as one shape; in dark mode it is a light chip on the navy wash.
 */
export const panelSidebarNavIconVariants = cva("-my-1 mr-2 -ml-1 box-content h-4 w-4 shrink-0 rounded-md p-1 transition-colors duration-200", {
	variants: {
		state: {
			default: "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
			active: "bg-sidebar-primary text-sidebar-primary-foreground group-hover:text-sidebar-primary-foreground",
			disabled: "text-sidebar-foreground/30",
		},
	},
	defaultVariants: {
		state: "default",
	},
});

export const panelSidebarNavChevronVariants = cva("h-3.5 w-3.5 shrink-0 transition-[transform,color] duration-200 ease-out motion-reduce:transition-none", {
	variants: {
		expanded: {
			true: "",
			false: "",
		},
		state: {
			default: "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70",
			active: "text-sidebar-active-foreground/70 group-hover:text-sidebar-active-foreground/70",
			disabled: "text-sidebar-foreground/30",
		},
	},
	compoundVariants: [
		{ expanded: true, state: "default", class: "rotate-90 text-sidebar-foreground/70" },
		{ expanded: true, state: "active", class: "rotate-90 text-sidebar-active-foreground/70 group-hover:text-sidebar-active-foreground/70" },
	],
	defaultVariants: {
		expanded: false,
		state: "default",
	},
});
