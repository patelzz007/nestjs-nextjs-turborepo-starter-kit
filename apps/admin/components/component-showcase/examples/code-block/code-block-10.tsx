"use client";

import type * as React from "react";

import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockExpandButton,
	CodeBlockHeader,
	CodeBlockTitle,
	useCodeBlockConfig,
} from "@workspace/ui/components/code-block";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";

/** The excerpt opens partway through the generated file, at this source line. */
const FIRST_LINE = 120;
/** How many generated rules the excerpt shows. */
const RULE_COUNT = 26;
/** Rows shown before "Show more". */
const COLLAPSED_LINES = 8;

/**
 * An excerpt that opens partway through a generated file, so the first row
 * reads 120 rather than 1. `startLine` only resets the gutter's CSS counter:
 * line specs keep addressing source lines, so moving the offset never
 * invalidates a `highlightedLines` value.
 */
const CODE = Array.from({ length: RULE_COUNT }, (_: undefined, index: number): string => {
	const id = String(index + FIRST_LINE);
	return `export const rule${id} = { id: ${id}, enabled: true }`;
}).join("\n");

interface CollapsibleAreaProps {
	readonly children: React.ReactNode;
}

/*
 * The collapse cap lives on the ScrollArea VIEWPORT and follows the block's
 * own `expanded` state through `useCodeBlockConfig`, so "Show more" releases
 * the cap and every scrollbar on this block is the shadcn one. `maxLines`
 * still marks the block collapsible; with the surface composed here it caps
 * nothing itself.
 */
function CollapsibleArea({ children }: CollapsibleAreaProps): React.JSX.Element {
	const { expanded } = useCodeBlockConfig("CollapsibleArea");

	return (
		<ScrollArea
			className={cn(
				"rounded-[inherit]",
				/* overflow-hidden makes collapsed mean collapsed - without it the
				   reader could wheel through everything under the "Show more" fade.
				   The 208px cap is chosen to LAND near maxLines' 8 rows, not derived
				   from it. */
				!expanded && "**:data-[slot=scroll-area-viewport]:max-h-52 **:data-[slot=scroll-area-viewport]:overflow-hidden",
			)}>
			{children}
			<ScrollBar orientation="horizontal" />
		</ScrollArea>
	);
}

export function CodeBlock10Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers startLine={FIRST_LINE} maxLines={COLLAPSED_LINES}>
				<CodeBlockHeader>
					<CodeBlockTitle>rules.generated.ts</CodeBlockTitle>
					<CodeBlockCopyButton className="ml-auto" />
				</CodeBlockHeader>
				<CollapsibleArea>
					<CodeBlockContent />
				</CollapsibleArea>
				<CodeBlockExpandButton />
			</CodeBlock>
		</div>
	);
}
