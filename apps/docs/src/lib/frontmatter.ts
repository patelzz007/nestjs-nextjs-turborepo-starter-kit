import { SyncedFromSchema } from "@workspace/docs-content/front-matter";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Front matter of the repo-root `docs/` guides and `docs/blog/` posts, so a field that is missing or misspelt
 * still fails the build.
 *
 * Every page has an author, a category and three dates (epoch ms), so no page ships unfiled or undated:
 *
 * | Field | Meaning | Set by |
 * |---|---|---|
 * | `date` | First published | The writer, once |
 * | `lastUpdated` | Last changed in a way a reader should know about | The writer |
 * | `editedAt` | Last edited at all | The docs sync (the writing tool's edit time), or the last commit for a page no tool owns yet |
 *
 * A cover is optional on guides: a missing cover must never block a fix (plan §6). `source` marks a file the docs
 * sync generated (ADR 084).
 */
const PageFrontmatterFields = {
	title: z.string().min(1),
	author: z.string().min(1),
	category: z.string().min(1),
	date: z.number().int(),
	lastUpdated: z.number().int(),
	editedAt: z.number().int(),
	source: SyncedFromSchema.optional(),
};

export const GuideFrontmatterSchema = z
	.object({
		...PageFrontmatterFields,
		description: z.string().optional(),
		order: z.number().int().min(1).optional(),
		coverImage: z.string().min(1).optional(),
		tags: z.array(z.string()).default([]),
	})
	.strict();
export type GuideFrontmatter = z.output<typeof GuideFrontmatterSchema>;

export const PostFrontmatterSchema = z
	.object({
		...PageFrontmatterFields,
		description: z.string().min(1),
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
