import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockLine, type CodeBlockToken } from "@workspace/ui/components/code-block";

const SOURCE = `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a`;

/** Splits a line around its keywords, keeping the keywords as their own parts. */
const KEYWORD_SPLIT = /(\b(?:def|for|in|return)\b)/;
const KEYWORD = /^(?:def|for|in|return)$/;

/*
 * Keywords take a theme token rather than a hex pair: the token already
 * resolves per mode, so the same value serves the light and the dark side.
 */
const KEYWORD_COLOR = "var(--tone-red)";

function toToken(content: string): CodeBlockToken {
	return KEYWORD.test(content) ? { content, color: KEYWORD_COLOR, colorDark: KEYWORD_COLOR } : { content };
}

/**
 * Lines built without shiki, to show the shape any highlighter can produce.
 *
 * The same array is what a server component gets back from `highlightCode` and
 * hands over the RSC boundary, so this is also the pre-highlighted path: the
 * client never loads a grammar.
 */
const LINES: CodeBlockLine[] = SOURCE.split("\n").map((text: string, index: number): CodeBlockLine => ({
	number: index + 1,
	text,
	tokens: text
		.split(KEYWORD_SPLIT)
		.filter((part: string): boolean => part !== "")
		.map(toToken),
}));

export function CodeBlock15Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock lines={LINES} showLineNumbers label="Python code">
				<CodeBlockHeader>
					<CodeBlockTitle>fib.py</CodeBlockTitle>
					<div className="ml-auto flex items-center gap-1.5">
						<span className="text-xs text-muted-foreground">No shiki on the client</span>
						<CodeBlockCopyButton value={SOURCE} />
					</div>
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
