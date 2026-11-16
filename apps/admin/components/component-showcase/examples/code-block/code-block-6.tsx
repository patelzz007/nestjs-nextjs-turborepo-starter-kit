"use client";

import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockTransformer } from "@workspace/ui/components/code-block";

/** The source line the notation marks as removed. */
const REMOVED_LINE = 2;
/** The source line the notation marks as added. */
const ADDED_LINE = 3;

/**
 * Diff styling expressed as notation inside the source rather than as props.
 * `transformers` is a straight pass-through to shiki, so `@shikijs/transformers`
 * works without the primitive knowing about it. The directive above is required:
 * this object carries a method, and functions cannot cross a server boundary.
 */
const NOTATION_DIFF: CodeBlockTransformer = {
	line(node, line): void {
		if (line === REMOVED_LINE) {
			node.properties.class = "line diff remove";
		}
		if (line === ADDED_LINE) {
			node.properties.class = "line diff add";
		}
	},
};

const CODE = `export function slugify(input: string) {
  return input.toLowerCase().replace(/ /g, "-")
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")
}`;

/* The array itself must be module-scope: `transformers` is a reference dep
   of the highlight effect, so a fresh array each render re-tokenizes. */
const TRANSFORMERS: CodeBlockTransformer[] = [NOTATION_DIFF];

export function CodeBlock6Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers transformers={TRANSFORMERS}>
				<CodeBlockHeader>
					<CodeBlockTitle>slugify.ts</CodeBlockTitle>
					<CodeBlockCopyButton className="ml-auto" />
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
