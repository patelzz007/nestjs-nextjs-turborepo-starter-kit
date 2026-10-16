"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	CodeBlock,
	CodeBlockHeader,
	CodeBlockLineActions,
	CodeBlockTitle,
	type CodeBlockLevelSpec,
	type CodeBlockLineActionContext,
} from "@workspace/ui/components/code-block";

const CODE = `export function parseAmount(input: string) {
  const value = parseInt(input)
  if (value == NaN) return 0
  return value
}`;

/** The diagnostics, by source line. */
const LINE_LEVELS: CodeBlockLevelSpec = { error: [3], warning: [2] };

/*
 * One group is REGISTERED for the whole block and rendered inside whichever
 * row is active, so a 2,000 line file costs a single button. Gated on the
 * diagnostic: a fix offer on a clean line is noise.
 */
function renderFixAction({ line, state }: CodeBlockLineActionContext): React.ReactNode {
	if (state?.level === undefined) {
		return null;
	}
	return (
		<Button size="xs" variant="outline" className="bg-background">
			Fix line {line}
		</Button>
	);
}

export function CodeBlock11Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers lineLevels={LINE_LEVELS}>
				<CodeBlockHeader>
					<CodeBlockTitle>parse-amount.ts</CodeBlockTitle>
					<div className="ml-auto flex items-center gap-1.5">
						<Badge variant="destructive-light">1 error</Badge>
						<Badge variant="warning-light">1 warning</Badge>
					</div>
				</CodeBlockHeader>
				<CodeBlockLineActions>{renderFixAction}</CodeBlockLineActions>
			</CodeBlock>
		</div>
	);
}
