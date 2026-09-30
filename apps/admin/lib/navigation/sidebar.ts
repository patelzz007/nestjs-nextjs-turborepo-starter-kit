import type { LucideIcon } from "lucide-react";
import { z } from "zod";

/**
 * Sidebar menu schemas live in `@workspace/client` (one strict source of
 * truth shared by admin, web, and merchant). Every level is `.strict()`, so an
 * `authorization` / `featureFlag` key can never be silently stripped — a
 * gated item cannot accidentally become public.
 */
export {
	CompiledSidebarMenuDataSchema,
	CompiledSidebarMenuItemSchema,
	CompiledSidebarMenuSectionSchema,
	SidebarAuthorizationSchema,
	SidebarMenuDataSchema,
	SidebarMenuHeaderSchema,
	SidebarMenuItemSchema,
	SidebarMenuSectionColorSchema,
	SidebarMenuSectionSchema,
} from "@workspace/client/lib/sidebar/sidebar-menu-schema";
export type {
	CompiledSidebarMenuData,
	CompiledSidebarMenuItem,
	CompiledSidebarMenuItemNode,
	CompiledSidebarMenuSection,
	SidebarAuthorization,
	SidebarMenuData,
	SidebarMenuHeader,
	SidebarMenuItem,
	SidebarMenuItemNode,
	SidebarMenuSection,
	SidebarMenuSectionColor,
} from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/** The signed-in user as shown in the sidebar / topbar / profile dropdown. */
export const SidebarUserSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
});

export type SidebarUser = z.output<typeof SidebarUserSchema>;

/**
 * A custom action rendered in the sidebar footer (e.g. "Report an issue").
 * Carries a component (`LucideIcon`) and a callback — a function contract, so
 * it stays a plain type rather than a zod schema.
 */
export interface FooterAction {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onClick: () => void;
}
