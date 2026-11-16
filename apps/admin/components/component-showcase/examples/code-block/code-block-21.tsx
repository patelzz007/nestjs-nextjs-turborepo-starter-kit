import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockLine, type CodeBlockToken } from "@workspace/ui/components/code-block";

/*
 * Terminal output with ANSI-style color, built as plain `lines`. Each token
 * carries its own light and dark color, so no grammar and no highlighter run:
 * this is the shape a PTY or CI log renderer would hand the block directly.
 * The colours are theme tokens, which already resolve per mode, so the same
 * value serves both sides.
 */
type TokenColor = Pick<CodeBlockToken, "color" | "colorDark">;

function tokenColor(value: string): TokenColor {
	return { color: value, colorDark: value };
}

const OK = tokenColor("var(--success)");
const ERR = tokenColor("var(--destructive)");
const DIM = tokenColor("var(--muted-foreground)");
const CYAN = tokenColor("var(--info)");

interface Row {
	readonly tokens: CodeBlockToken[];
}

const ROWS: readonly Row[] = [
	{ tokens: [{ content: "$ ", ...DIM }, { content: "vitest run" }] },
	{
		tokens: [
			{ content: "RUN ", ...CYAN },
			{ content: "v4.1.9 ", ...DIM },
			{ content: "~/acme/web", ...DIM },
		],
	},
	{ tokens: [] },
	{
		tokens: [{ content: "✓ ", ...OK }, { content: "tests/checkout.test.ts " }, { content: "(12 tests) 84ms", ...DIM }],
	},
	{
		tokens: [{ content: "✓ ", ...OK }, { content: "tests/pricing.test.ts " }, { content: "(9 tests) 41ms", ...DIM }],
	},
	{
		tokens: [{ content: "✗ ", ...ERR }, { content: "tests/session.test.ts " }, { content: "(1 failed) 102ms", ...DIM }],
	},
	{ tokens: [] },
	{
		tokens: [{ content: "FAIL ", ...ERR }, { content: "session refresh keeps the device id" }],
	},
	{
		tokens: [
			{ content: "  expected ", ...DIM },
			{ content: '"dev_4812"', ...OK },
			{ content: " to equal ", ...DIM },
			{ content: '"dev_4811"', ...ERR },
		],
	},
	{ tokens: [] },
	{
		tokens: [
			{ content: "Tests ", ...DIM },
			{ content: "1 failed", ...ERR },
			{ content: " | ", ...DIM },
			{ content: "21 passed", ...OK },
			{ content: " (22)", ...DIM },
		],
	},
];

const LINES: CodeBlockLine[] = ROWS.map((row: Row, index: number): CodeBlockLine => ({
	tokens: row.tokens,
	number: index + 1,
	text: row.tokens.map((token: CodeBlockToken): string => token.content).join(""),
}));

const RAW = LINES.map((line: CodeBlockLine): string => line.text).join("\n");

export function CodeBlock21Example(): React.JSX.Element {
	return (
		/* Forced dark, like a real test log; c-code-block-20 explains the
		   wrapper. `lines` skips the client highlighter entirely - these rows
		   were coloured ahead of time, so the copy button is handed the raw
		   text explicitly. */
		<div className="dark w-full max-w-2xl">
			<CodeBlock lines={LINES} label="Test run output">
				<CodeBlockHeader>
					<CodeBlockTitle>vitest</CodeBlockTitle>
					<CodeBlockCopyButton value={RAW} className="ml-auto" />
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
