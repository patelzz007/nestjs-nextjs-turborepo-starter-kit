import { z } from "zod";

export interface SidebarMenuItemNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: readonly SidebarMenuItemNode[];
}

export const SidebarMenuItemSchema: z.ZodType<SidebarMenuItemNode> = z.lazy(() =>
	z.object({
		title: z.string().min(1),
		url: z.string(),
		icon: z.string().optional(),
		disabled: z.boolean().optional(),
		children: z.array(z.lazy(() => SidebarMenuItemSchema)).optional(),
	}),
);

export type SidebarMenuItem = z.output<typeof SidebarMenuItemSchema>;

export const SidebarMenuSectionColorSchema = z.enum(["blue", "green", "amber", "rose", "purple", "teal"]);

export type SidebarMenuSectionColor = z.output<typeof SidebarMenuSectionColorSchema>;

export const SidebarMenuSectionSchema = z.object({
	title: z.string().min(1),
	color: SidebarMenuSectionColorSchema.optional(),
	items: z.array(SidebarMenuItemSchema),
});

export type SidebarMenuSection = z.output<typeof SidebarMenuSectionSchema>;

export const SidebarMenuHeaderSchema = z.object({
	title: z.string().min(1),
	subtitle: z.string(),
});

export type SidebarMenuHeader = z.output<typeof SidebarMenuHeaderSchema>;

/** Raw sidebar menu JSON — parsed at app startup before loading into the zustand store. */
export const SidebarMenuDataSchema = z
	.object({
		header: SidebarMenuHeaderSchema,
		sections: z.array(SidebarMenuSectionSchema),
		bottomItems: z.array(SidebarMenuItemSchema),
	})
	.strict();

export type SidebarMenuData = z.output<typeof SidebarMenuDataSchema>;

export interface CompiledSidebarMenuItemNode {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: readonly CompiledSidebarMenuItemNode[];
}

export const CompiledSidebarMenuItemSchema: z.ZodType<CompiledSidebarMenuItemNode> = z.lazy(() =>
	z.object({
		id: z.string().min(1),
		title: z.string().min(1),
		url: z.string(),
		icon: z.string().optional(),
		disabled: z.boolean().optional(),
		children: z.array(z.lazy(() => CompiledSidebarMenuItemSchema)).optional(),
	}),
);

export type CompiledSidebarMenuItem = z.output<typeof CompiledSidebarMenuItemSchema>;

export const CompiledSidebarMenuSectionSchema = z.object({
	title: z.string().min(1),
	color: SidebarMenuSectionColorSchema.optional(),
	items: z.array(CompiledSidebarMenuItemSchema).readonly(),
});

export type CompiledSidebarMenuSection = z.output<typeof CompiledSidebarMenuSectionSchema>;

export const CompiledSidebarMenuDataSchema = z
	.object({
		header: SidebarMenuHeaderSchema,
		sections: z.array(CompiledSidebarMenuSectionSchema),
		bottomItems: z.array(CompiledSidebarMenuItemSchema).readonly(),
	})
	.strict();

export type CompiledSidebarMenuData = z.output<typeof CompiledSidebarMenuDataSchema>;
