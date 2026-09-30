import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { contentId } from "./lib/navigation";

/**
 * Guides live in the repo-root `docs/` folder and articles in `blog/` — one
 * source of truth, rendered here. Ids keep the file path (and its case):
 * `authorization-system/overview.md` → `/docs/authorization-system/overview`.
 *
 * `author`, `lastUpdated` (epoch ms) and `coverImage` are required so no page
 * ships undated or without social preview art.
 */
const docs = defineCollection({
	loader: glob({ base: "../../docs", pattern: "**/*.md", generateId: ({ entry }) => contentId(entry) }),
	schema: z
		.object({
			title: z.string().min(1),
			description: z.string().optional(),
			order: z.number().int().min(1).optional(),
			author: z.string().min(1),
			lastUpdated: z.number().int(),
			coverImage: z.string().min(1),
			tags: z.array(z.string()).default([]),
		})
		.strict(),
});

const blog = defineCollection({
	loader: glob({ base: "../../blog", pattern: "**/*.md", generateId: ({ entry }) => contentId(entry) }),
	schema: z
		.object({
			title: z.string().min(1),
			description: z.string().min(1),
			author: z.string().min(1),
			date: z.number().int(),
			category: z.string().min(1),
			status: z.string().optional(),
			coverImage: z.string().optional(),
		})
		.strict(),
});

export const collections = { docs, blog };
