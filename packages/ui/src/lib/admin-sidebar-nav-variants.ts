import { cva } from "class-variance-authority";

/** Admin app sidebar nav row styles — consumed by `apps/admin` only. */
export const adminSidebarNavItemVariants = cva(
	"group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-[background-color,color,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.99]",
	{
		variants: {
			state: {
				default: "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/40",
				active:
					"bg-sidebar-primary font-medium text-sidebar-primary-foreground focus-visible:ring-sidebar-primary-foreground/50",
				disabled: "cursor-not-allowed text-muted-foreground opacity-50",
			},
		},
		defaultVariants: {
			state: "default",
		},
	},
);

export const adminSidebarNavIconVariants = cva("mr-3 h-4 w-4 shrink-0 transition-colors duration-200", {
	variants: {
		state: {
			default: "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
			active: "text-sidebar-primary-foreground",
			disabled: "text-muted-foreground",
		},
	},
	defaultVariants: {
		state: "default",
	},
});

export const adminSidebarNavChevronVariants = cva("h-3.5 w-3.5 shrink-0 transition-[transform,color] duration-200 ease-out", {
	variants: {
		expanded: {
			true: "",
			false: "",
		},
		state: {
			default: "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70",
			active: "text-sidebar-primary-foreground/80",
			disabled: "text-muted-foreground",
		},
	},
	compoundVariants: [
		{ expanded: true, state: "default", class: "rotate-90 text-sidebar-foreground/70" },
		{ expanded: true, state: "active", class: "rotate-90 text-sidebar-primary-foreground/80" },
	],
	defaultVariants: {
		expanded: false,
		state: "default",
	},
});
