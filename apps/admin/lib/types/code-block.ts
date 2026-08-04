import { z } from "zod";

/**
 * The languages the markdown code blocks know how to highlight. Declared as a
 * typed **tuple** (rule 4 — no `as const`), and the schema/type are derived
 * with `z.enum` + `z.infer` (rule 5).
 */
export const CODE_LANGUAGES: ["bash", "typescript", "ts", "tsx", "js", "jsx", "json", "sql", "prisma", "env", "css", "html", "yaml", "ini", "markdown", "plaintext"] = [
	"bash",
	"typescript",
	"ts",
	"tsx",
	"js",
	"jsx",
	"json",
	"sql",
	"prisma",
	"env",
	"css",
	"html",
	"yaml",
	"ini",
	"markdown",
	"plaintext",
];

/** Zod schema for a valid code-block language (used to validate fence language tags). */
export const CodeLanguage = z.enum(CODE_LANGUAGES);

export type CodeLanguage = z.infer<typeof CodeLanguage>;
