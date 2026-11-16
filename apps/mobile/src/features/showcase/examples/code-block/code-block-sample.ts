// What the CodeBlock examples share: their snippets (snippets.json, coloured by the showcase generator, so the phone
// runs no highlighter), a copy-to-clipboard hook, and the first characters of a coloured snippet (a typed-out reply).

import type { CodeBlockLine } from "@workspace/ui-native/components/code-block";
import * as Clipboard from "expo-clipboard";
import * as React from "react";

import { SHOWCASE_SNIPPETS } from "../../generated/snippets/code-block";
import { decodeHighlightedCode } from "../../showcase-code";

export interface Snippet {
	readonly code: string;
	readonly lines: readonly CodeBlockLine[];
}

/** A snippet by its id, its text and its coloured lines; empty for an id the file lacks. */
export function snippet(id: string): Snippet {
	const found = SHOWCASE_SNIPPETS.get(id);
	return found === undefined ? { code: "", lines: [] } : { code: found.code, lines: decodeHighlightedCode(found.lines) };
}

/** How long a copy button shows its check. */
const COPIED_MS = 1500;

/** Copies `text` and says so for a moment (`copied`), for a block's copy button. */
export function useCopy(text: string): { readonly copied: boolean; readonly copy: () => void } {
	const [copied, setCopied] = React.useState(false);
	React.useEffect((): (() => void) | undefined => {
		if (!copied) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setCopied(false);
		}, COPIED_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [copied]);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(text)
			.then((): void => {
				setCopied(true);
			})
			// A refused copy leaves the button as it was.
			.catch((): void => undefined);
	}, [text]);
	return { copied, copy };
}

/** The first `count` characters of coloured lines (line breaks count as one), for code typed out as it streams. */
export function revealLines(lines: readonly CodeBlockLine[], count: number): readonly CodeBlockLine[] {
	const out: CodeBlockLine[] = [];
	let left = count;
	for (const line of lines) {
		if (left <= 0) {
			break;
		}
		const tokens: CodeBlockLine[number][] = [];
		for (const token of line) {
			if (left <= 0) {
				break;
			}
			tokens.push({ ...token, text: token.text.slice(0, left) });
			left -= token.text.length;
		}
		out.push(tokens);
		left -= 1;
	}
	return out;
}

/** How many characters a set of lines holds, line breaks included. */
export function characterCount(lines: readonly CodeBlockLine[]): number {
	return lines.reduce((total: number, line): number => total + line.reduce((sum: number, token): number => sum + token.text.length, 0) + 1, 0);
}
