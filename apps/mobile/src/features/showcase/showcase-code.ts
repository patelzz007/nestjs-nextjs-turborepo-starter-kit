import { z } from "zod";

/**
 * What one coloured piece of code is, as the showcase generator found it:
 * Shiki reads every example with the web's own themes (GitHub light and dark)
 * and the generator names each colour by what it marks, so the phone draws
 * the web's colours from its own theme tokens (`text-code-<role>`), never from
 * colour literals. `plain` is everything uncoloured.
 */
export const CodeRoleSchema = z.enum(["plain", "keyword", "function", "constant", "string", "comment", "tag", "parameter"]);

export type CodeRole = z.output<typeof CodeRoleSchema>;

/** One piece of a line: what it is, and its text. */
export interface CodeToken {
	readonly role: CodeRole;
	readonly text: string;
}

/**
 * A highlighted source as the generator writes it, compact: its lines joined by "\n", each line's tokens joined by
 * `TOKEN_SEPARATOR`, each token its role's position in `CodeRoleSchema.options` (one digit) then its text.
 */
export type HighlightedCode = string;

/** Between two tokens of a line: the ASCII unit separator, which no source contains. */
export const TOKEN_SEPARATOR = "\u001f";
const LINE_SEPARATOR = "\n";

/** The role at `index`, or `plain` for an index the generator never writes. */
export function codeRoleAt(index: number): CodeRole {
	return CodeRoleSchema.options.at(index) ?? "plain";
}

/** A highlighted source's lines of tokens (an empty line has none). */
export function decodeHighlightedCode(encoded: HighlightedCode): readonly (readonly CodeToken[])[] {
	return encoded
		.split(LINE_SEPARATOR)
		.map((line: string): readonly CodeToken[] =>
			line.length === 0 ? [] : line.split(TOKEN_SEPARATOR).map((token: string): CodeToken => ({ role: codeRoleAt(Number(token.charAt(0))), text: token.slice(1) })),
		);
}
