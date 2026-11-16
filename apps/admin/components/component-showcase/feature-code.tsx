"use client";

import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@workspace/ui/components/code-block";
import { COLLAPSED_LINES } from "@/components/component-showcase/feature-code-layout";

export interface FeatureCodeProps {
	/** The example's exact source. */
	readonly source: string;
	/** The example's file name, shown in the block's header. */
	readonly title: string;
	readonly className?: string | undefined;
}

/** The exact source of one feature's example, highlighted, collapsed past `COLLAPSED_LINES` lines. */
export function FeatureCode({ source, title, className }: FeatureCodeProps): React.JSX.Element {
	return (
		<CodeBlock code={source} language="tsx" showLineNumbers maxLines={COLLAPSED_LINES} className={className}>
			<CodeBlockHeader>
				<CodeBlockTitle>{title}</CodeBlockTitle>
				<CodeBlockLanguage />
				<CodeBlockCopyButton className="ms-auto" />
			</CodeBlockHeader>
		</CodeBlock>
	);
}
