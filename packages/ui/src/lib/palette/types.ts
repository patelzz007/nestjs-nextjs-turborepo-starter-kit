import { z } from "zod";

export const PaletteSearchableItemSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		url: z.string(),
		icon: z.string().optional(),
		section: z.string(),
		breadcrumb: z.array(z.string()).readonly(),
	})
	.strict();

export type PaletteSearchableItem = z.output<typeof PaletteSearchableItemSchema>;

export const PaletteRecentSearchSchema = z
	.object({
		title: z.string(),
		url: z.string(),
		section: z.string(),
		icon: z.string().optional(),
	})
	.strict();

export type PaletteRecentSearch = z.output<typeof PaletteRecentSearchSchema>;
