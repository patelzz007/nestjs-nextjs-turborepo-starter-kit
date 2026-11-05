// The code block's model (enhancement 8.1: split from code-block.tsx): fold regions and token styles.

import { type CodeBlockLine, type CodeBlockToken } from "@workspace/ui/components/code-block-highlight";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface CodeBlockFoldRegion {
	/** Source line that owns the toggle and stays visible when folded. */
	start: number;
	/** Last source line the region swallows. */
	end: number;
}

export const INDENT_RE = /^(?<indent>[ \t]*)/;

export function indentOf(text: string): number {
	return (INDENT_RE.exec(text)?.groups?.indent ?? "").replace(/\t/g, "  ").length;
}

export function isBlank(text: string): boolean {
	return text.trim().length === 0;
}

export interface OpenFoldRegion {
	start: number;
	indent: number;
	last: number;
}

/**
 * Regions come from indentation, not the grammar: shiki returns tokens, no
 * AST, and indentation is language-agnostic where a brace matcher is not.
 * A tab counts as two columns; only self-consistency matters.
 */
export function computeFoldRegions(lines: CodeBlockLine[]): CodeBlockFoldRegion[] {
	/* One pass with an open-region stack instead of a nested scan per line:
	   the old shape was quadratic on monotonically indenting files and re-ran
	   per streamed chunk. A region closes when a non-blank line returns to its
	   opener's indent; trailing blanks belong to whatever follows. */
	const regions: CodeBlockFoldRegion[] = [];
	const stack: OpenFoldRegion[] = [];
	let previous: { number: number; indent: number } | null = null;

	const close = (open: OpenFoldRegion): void => {
		if (open.last > open.start) {
			regions.push({ start: open.start, end: open.last });
		}
	};

	for (const line of lines) {
		if (isBlank(line.text)) continue;
		const own = indentOf(line.text);

		let top = stack.at(-1);
		while (top && own <= top.indent) {
			stack.pop();
			close(top);
			top = stack.at(-1);
		}
		for (const open of stack) open.last = line.number;

		if (previous && own > previous.indent) {
			stack.push({
				start: previous.number,
				indent: previous.indent,
				last: line.number,
			});
		}
		previous = { number: line.number, indent: own };
	}

	for (let open = stack.pop(); open; open = stack.pop()) {
		close(open);
	}

	return regions.sort((a, b) => a.start - b.start);
}

/** Frozen so the disabled path keeps a stable identity across renders. */
export const EMPTY_FOLD_REGIONS: CodeBlockFoldRegion[] = [];

/* -------------------------------------------------------------------------- */
/*                                    Tokens                                   */
/* -------------------------------------------------------------------------- */

export type TokenStyle = React.CSSProperties & Partial<Record<"--cb-c" | "--cb-cd", string>>;

export function tokenStyle(token: CodeBlockToken): React.CSSProperties | undefined {
	if (!token.color && !token.colorDark && !token.fontStyle) return undefined;

	const style: TokenStyle = {};
	if (token.color) style["--cb-c"] = token.color;
	if (token.colorDark) style["--cb-cd"] = token.colorDark;
	if (token.fontStyle === "italic") style.fontStyle = "italic";
	if (token.fontStyle === "bold") style.fontWeight = 700;
	if (token.fontStyle === "underline") style.textDecoration = "underline";
	return style;
}

export function CodeBlockTokens({ tokens }: { readonly tokens: CodeBlockToken[] }): React.JSX.Element {
	/* Tokens have no identity beyond their position in the line, which is also
	   what the highlighter's reuse compares; the position is the key. */
	const nodes: React.ReactNode[] = [];
	for (const [position, token] of tokens.entries()) {
		const style = tokenStyle(token);

		/* An unstyled token needs no element at all. Whitespace and
		   punctuation are most of a file, so this removes most of the spans. */
		if (!style && !token.word) {
			nodes.push(<span key={position}>{token.content}</span>);
			continue;
		}

		nodes.push(
			<span
				key={position}
				data-slot="code-block-token"
				data-word={token.word ? true : undefined}
				className={cn(token.word ? "rounded-sm bg-primary/10 px-0.5 py-px ring-1 ring-primary/20 ring-inset" : undefined)}
				style={style}>
				{token.content}
			</span>,
		);
	}
	return <>{nodes}</>;
}

/* -------------------------------------------------------------------------- */
/*                                     Line                                    */
/* -------------------------------------------------------------------------- */
