import { z } from "zod";

export const CreateMenuItemSchema = z
	.object({
		name: z.string().max(100).meta({
			description: "Display name of the menu item",
		}),
		label: z.string().max(100).optional().meta({
			description: "Optional override label for display",
		}),
		icon: z.string().max(50).optional().meta({
			description: "Icon identifier for the frontend",
		}),
		path: z.string().max(255).optional().meta({
			description: "Route path",
		}),
		parentId: z.uuid().optional().meta({
			description: "Parent menu item ID (UUID of parent for nesting)",
		}),
		order: z.coerce.number().min(0).optional().default(0).meta({
			description: "Display order within sibling group",
			default: 0,
		}),
		isActive: z.boolean().optional().default(true).meta({
			description: "Whether the menu item is active",
			default: true,
		}),
	})
	.strict();

export type CreateMenuItemInput = z.output<typeof CreateMenuItemSchema>;

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial().strict();

export type UpdateMenuItemInput = z.output<typeof UpdateMenuItemSchema>;

export const MenuMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type MenuMessageResponse = z.output<typeof MenuMessageResponseSchema>;

/**
 * Menu item response shape returned by the API.
 * Uses z.lazy() for recursive children support — the type is derived from the
 * schema (rule 5); the anchor node type stays internal to this module.
 */
interface MenuItemResponseNode {
	readonly id: string;
	readonly name: string;
	readonly icon: string | null;
	readonly path: string | null;
	readonly order: number;
	readonly children: readonly MenuItemResponseNode[];
}

export const MenuItemResponseSchema: z.ZodType<MenuItemResponseNode> = z
	.object({
		id: z.string().describe("Unique identifier"),
		name: z.string().describe("Display name of the menu item"),
		icon: z.string().nullable().describe("Icon identifier for the frontend"),
		path: z.string().nullable().describe("Route path"),
		order: z.number().describe("Display order within sibling group"),
		children: z.lazy(() => z.array(MenuItemResponseSchema)).describe("Child menu items"),
	})
	.strict();

export type MenuItemResponse = z.output<typeof MenuItemResponseSchema>;
