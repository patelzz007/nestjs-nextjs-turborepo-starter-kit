import { z } from "zod";

/**
 * Props for one hydrated code block, serialised into the page at build time
 * and parsed back in the browser. The schema mirrors `CodeBlockLine` from
 * `@workspace/ui/components/display/code-block-highlight`, so what the build
 * highlighted is exactly what React hydrates. Optional fields use
 * `exactOptional()` (absent, never `undefined`) to match those types under
 * `exactOptionalPropertyTypes`.
 */
export const CodeBlockTokenSchema = z
	.object({
		content: z.string(),
		color: z.string().exactOptional(),
		colorDark: z.string().exactOptional(),
		fontStyle: z.enum(["italic", "bold", "underline"]).exactOptional(),
		word: z.boolean().exactOptional(),
	})
	.strict();

export const CodeBlockLineStateSchema = z
	.object({
		highlighted: z.boolean().exactOptional(),
		diff: z.enum(["add", "remove"]).exactOptional(),
		focused: z.boolean().exactOptional(),
		level: z.enum(["error", "warning", "info"]).exactOptional(),
	})
	.strict();

export const CodeBlockLineSchema = z
	.object({
		tokens: z.array(CodeBlockTokenSchema),
		number: z.number().int(),
		text: z.string(),
		state: CodeBlockLineStateSchema.exactOptional(),
		gutter: z.string().exactOptional(),
	})
	.strict();

export const DocsCodeBlockPropsSchema = z
	.object({
		lines: z.array(CodeBlockLineSchema),
		/** Fence tag as written (`ts`, `bash`); empty for untagged fences. */
		language: z.string(),
		/** `title="…"` from the fence meta. */
		title: z.string().nullable(),
		showLineNumbers: z.boolean(),
		/** Indentation-based folding (off for shell / text snippets). */
		foldable: z.boolean(),
		/** Long blocks start collapsed to this many lines; `null` shows everything. */
		maxLines: z.number().int().positive().nullable(),
	})
	.strict();

export type DocsCodeBlockProps = z.output<typeof DocsCodeBlockPropsSchema>;

/** Languages rendered without line numbers or folding (terminal sessions, config snippets, prose). */
const PLAIN_LANGUAGES: ReadonlySet<string> = new Set(["", "text", "txt", "plaintext", "bash", "sh", "shell", "zsh", "console", "powershell", "env", "dotenv"]);

/** Blocks longer than this start collapsed. */
export const COLLAPSE_AFTER_LINES = 30;
/** How many lines a collapsed block shows. */
export const COLLAPSED_LINES = 20;

/** Presentation defaults for a fence: numbers + folding for real code, collapse for long blocks. */
export function presentationFor(language: string, lineCount: number): Pick<DocsCodeBlockProps, "showLineNumbers" | "foldable" | "maxLines"> {
	const code = !PLAIN_LANGUAGES.has(language.toLowerCase());
	return {
		showLineNumbers: code && lineCount > 1,
		foldable: code && lineCount > 1,
		maxLines: lineCount > COLLAPSE_AFTER_LINES ? COLLAPSED_LINES : null,
	};
}

/** JSON for an inline `<script type="application/json">`: `<` is escaped so the payload can never close the tag. */
export function serializeProps(props: DocsCodeBlockProps): string {
	return JSON.stringify(props).replace(/</g, "\\u003c");
}

/** Parses a serialised payload (throws on anything the build did not produce). */
export function parseProps(json: string): DocsCodeBlockProps {
	return DocsCodeBlockPropsSchema.parse(JSON.parse(json));
}
