import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Front matter of the repo-root `docs/` guides and `docs/blog/` posts — the schemas the Astro content
 * collections used, unchanged, so a field that is missing or misspelt still fails the build.
 *
 * `author`, `lastUpdated` (epoch ms) and `coverImage` are required on guides so no page ships undated or
 * without its cover; a post's cover is optional.
 */
export const GuideFrontmatterSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().optional(),
		order: z.number().int().min(1).optional(),
		author: z.string().min(1),
		lastUpdated: z.number().int(),
		coverImage: z.string().min(1),
		tags: z.array(z.string()).default([]),
	})
	.strict();
export type GuideFrontmatter = z.output<typeof GuideFrontmatterSchema>;

export const PostFrontmatterSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().min(1),
		author: z.string().min(1),
		date: z.number().int(),
		category: z.string().min(1),
		status: z.string().optional(),
		coverImage: z.string().optional(),
	})
	.strict();
export type PostFrontmatter = z.output<typeof PostFrontmatterSchema>;

/** A Markdown file split into its front matter and body. */
export interface ParsedMarkdown<TData> {
	readonly data: TData;
	readonly body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n(?<yaml>[\s\S]*?)\r?\n---(?:\r?\n|$)(?<body>[\s\S]*)$/;

/** A front matter error that names the file, so a broken guide is found at once. */
export class FrontmatterError extends Error {
	public constructor(
		public readonly file: string,
		detail: string,
	) {
		super(`${file}: ${detail}`);
		this.name = "FrontmatterError";
	}
}

/** Splits `---` front matter from the body and validates it with `schema`; throws {@link FrontmatterError}. */
export function parseMarkdownFile<TSchema extends z.ZodType>(file: string, source: string, schema: TSchema): ParsedMarkdown<z.output<TSchema>> {
	const match = FRONTMATTER_PATTERN.exec(source);
	if (match?.groups === undefined) {
		throw new FrontmatterError(file, "missing the `---` front matter block");
	}
	const { yaml = "", body = "" } = match.groups;
	const result = schema.safeParse(parseYaml(yaml));
	if (!result.success) {
		throw new FrontmatterError(file, z.prettifyError(result.error));
	}
	return { data: result.data, body };
}
