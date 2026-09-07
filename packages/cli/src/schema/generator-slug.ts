import { z } from "zod";

/** Safe resource slug: lowercase alphanumeric segments separated by hyphens. */
export const GeneratorSlugSchema = z
	.string()
	.min(1)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric segments separated by hyphens");

export type GeneratorSlug = z.output<typeof GeneratorSlugSchema>;

/** Parses and validates a generator resource slug. */
export function parseGeneratorSlug(value: string): GeneratorSlug {
	return GeneratorSlugSchema.parse(value);
}
