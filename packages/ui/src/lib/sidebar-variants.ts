import { cva } from "class-variance-authority";

const sidebarMenuItemBase =
	"flex w-full items-center gap-2 overflow-hidden rounded-md text-start ring-sidebar-ring outline-hidden transition-[width,height,padding,background-color,color] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate";

export const sidebarMenuButtonVariants = cva(
	`peer/menu-button group/menu-button ${sidebarMenuItemBase} p-2 group-has-data-[sidebar=menu-action]/menu-item:pe-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground`,
	{
		variants: {
			variant: {
				default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
				outline:
					"bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
			},
			size: {
				default: "h-8 text-sm",
				sm: "h-7 text-xs",
				lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
			},
			state: {
				default: "",
				active:
					"bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary! hover:text-sidebar-primary-foreground! data-active:bg-sidebar-primary data-active:font-medium data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary! data-active:hover:text-sidebar-primary-foreground!",
				disabled: "pointer-events-none opacity-50",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			state: "default",
		},
	},
);

export const sidebarMenuSubButtonVariants = cva(
	`${sidebarMenuItemBase} h-8 min-w-0 -translate-x-px px-2 text-sidebar-foreground group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground rtl:translate-x-px [&>svg]:text-sidebar-accent-foreground`,
	{
		variants: {
			size: {
				sm: "text-xs",
				md: "text-sm",
			},
			state: {
				default: "",
				active:
					"bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary! hover:text-sidebar-primary-foreground! data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary! data-active:hover:text-sidebar-primary-foreground! data-active:[&>svg]:text-sidebar-primary-foreground",
				disabled: "pointer-events-none opacity-50",
			},
		},
		defaultVariants: {
			size: "md",
			state: "default",
		},
	},
);
