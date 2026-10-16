"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { CodeBlock, CodeBlockHeader, CodeBlockTitle, type CodeBlockLineSpec } from "@workspace/ui/components/code-block";

const CODE = `export async function checkout(cart: Cart) {
  const totals = computeTotals(cart)

  const session = await payments.createSession({
    amount: totals.total,
    currency: cart.currency,
  })

  await audit.record("checkout.started", session.id)
  return session
}`;

interface Step {
	readonly label: string;
	/** Source lines this step keeps in focus. */
	readonly lines: CodeBlockLineSpec;
}

const STEPS: readonly Step[] = [
	{ label: "Totals", lines: "2" },
	{ label: "Payment session", lines: "4-7" },
	{ label: "Audit", lines: "9-10" },
];

interface StepButtonProps {
	readonly step: Step;
	readonly index: number;
	readonly isActive: boolean;
	readonly onSelect: (index: number) => void;
}

function StepButton({ step, index, isActive, onSelect }: StepButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(index);
	}, [index, onSelect]);

	return (
		<Button aria-pressed={isActive} size="xs" variant={isActive ? "secondary" : "ghost"} onClick={handleClick}>
			{step.label}
		</Button>
	);
}

/*
 * `focusedLines` keeps a step sharp and dims the rest - unlike highlighting,
 * which adds emphasis without taking any away. Hovering the block restores
 * everything, so the surrounding code is one glance away.
 */
export function CodeBlock8Example(): React.JSX.Element {
	const [activeIndex, setActiveIndex] = React.useState(0);

	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers focusedLines={STEPS[activeIndex]?.lines}>
				<CodeBlockHeader className="gap-1.5">
					<CodeBlockTitle>checkout.ts</CodeBlockTitle>
					<div role="group" aria-label="Walkthrough step" className="ml-auto flex items-center gap-1">
						{STEPS.map((step: Step, index: number): React.JSX.Element => (
							<StepButton key={step.label} step={step} index={index} isActive={index === activeIndex} onSelect={setActiveIndex} />
						))}
					</div>
					<Badge variant="primary-light">
						{activeIndex + 1}/{STEPS.length}
					</Badge>
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
