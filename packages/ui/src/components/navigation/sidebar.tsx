"use client";

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
} from "./sidebar-parts";

export { SidebarProvider, useSidebar } from "./sidebar-context";

export type { SidebarLabels } from "@workspace/ui/lib/sidebar/labels";
export { createCookieSidebarStorage, createNoopSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/lib/sidebar/storage";
export { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "@workspace/ui/lib/sidebar/variants";
