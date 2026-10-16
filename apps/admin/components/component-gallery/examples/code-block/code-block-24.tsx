"use client";

import { SparklesIcon } from "lucide-react";
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

const BROKEN = `export function totalDue(invoice: Invoice) {
  const lines = invoice.lines.map((line) => line.amount)
  const subtotal = lines.reduce((sum, amount) => sum + amount)
  return subtotal + invoice.tax
}`;

const PATCHED = `export function totalDue(invoice: Invoice) {
  const lines = invoice.lines.map((line) => line.amount)
  const subtotal = lines.reduce((sum, amount) => sum + amount, 0)
  return subtotal + invoice.tax
}`;

/** The reduce without a seed, by source line. */
const BROKEN_LINE_LEVELS: CodeBlockLevelSpec = { error: [3] };

export function CodeBlock24Example(): React.JSX.Element {
	const [fixed, setFixed] = React.useState(false);

	const handleFix = React.useCallback((): void => {
		setFixed(true);
	}, []);
	const handleUndo = React.useCallback((): void => {
		setFixed(false);
	}, []);

	/*
	 * The action is scoped to the line that actually carries the diagnostic:
	 * the render prop receives that line's state, so one group serves the
	 * whole block and still only offers the fix where there is something to
	 * fix.
	 */
	const renderFixAction = React.useCallback(
		({ state }: CodeBlockLineActionContext): React.ReactNode =>
			state?.level === "error" ? (
				<Button size="xs" onClick={handleFix}>
					<SparklesIcon />
					Fix with AI
				</Button>
			) : null,
		[handleFix],
	);

	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={fixed ? PATCHED : BROKEN} language="typescript" showLineNumbers lineLevels={fixed ? undefined : BROKEN_LINE_LEVELS}>
				<CodeBlockHeader>
					<CodeBlockTitle>invoice.ts</CodeBlockTitle>
					<div className="ml-auto flex items-center gap-1.5">
						{fixed ? (
							<>
								<Badge variant="success-light">Patch applied</Badge>
								<Button size="xs" variant="ghost" onClick={handleUndo}>
									Undo
								</Button>
							</>
						) : (
							<Badge variant="destructive-light">Empty array crashes reduce</Badge>
						)}
					</div>
				</CodeBlockHeader>
				<CodeBlockLineActions>{renderFixAction}</CodeBlockLineActions>
			</CodeBlock>
		</div>
	);
}
