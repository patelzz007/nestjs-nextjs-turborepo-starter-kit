"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { CodeBlock, CodeBlockHeader, CodeBlockTitle } from "@workspace/ui/components/code-block";

const CODE = `function applyDiscount(order: Order) {
  if (order.coupon) {
    const rate = COUPONS[order.coupon]
    order.total = order.total * (1 - rate)
  }
  return order
}`;

/*
  Selection arrives sorted but not necessarily contiguous, so a range label
  would lie about a click on 2 and 6. Count is the only honest summary.
*/
function describeSelection(lines: readonly number[]): string {
	const [only, ...rest] = lines;
	if (only === undefined) {
		return "Select lines to ask about them";
	}
	if (rest.length === 0) {
		return `Ask about line ${String(only)}`;
	}
	return `Ask about ${String(lines.length)} lines`;
}

export function CodeBlock12Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<number[]>([]);

	const handleClear = React.useCallback((): void => {
		setSelected([]);
	}, []);

	const hasSelection = selected.length > 0;

	return (
		<div className="flex w-full max-w-2xl flex-col gap-3">
			<CodeBlock code={CODE} language="typescript" showLineNumbers selectable selectedLines={selected} onSelectedLinesChange={setSelected}>
				<CodeBlockHeader>
					<CodeBlockTitle>discount.ts</CodeBlockTitle>
					<div className="ml-auto flex items-center gap-1.5">
						{hasSelection ? <Badge variant="primary-light">{selected.length} selected</Badge> : null}
						<span className="text-xs text-muted-foreground">Click a line, shift-click to extend</span>
					</div>
				</CodeBlockHeader>
			</CodeBlock>

			<div className="flex items-center gap-2">
				<Button size="sm" disabled={!hasSelection}>
					{describeSelection(selected)}
				</Button>
				{hasSelection ? (
					<Button size="sm" variant="ghost" onClick={handleClear}>
						Clear
					</Button>
				) : null}
			</div>
		</div>
	);
}
