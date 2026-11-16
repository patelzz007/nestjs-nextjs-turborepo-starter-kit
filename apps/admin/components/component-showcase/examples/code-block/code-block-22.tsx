"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { CodeBlock, CodeBlockHeader, CodeBlockTitle, type CodeBlockDiffSpec } from "@workspace/ui/components/code-block";

const PATCH = `export async function retryPayment(orderId: string) {
  const order = await orders.find(orderId)
  await payments.charge(order)
  const receipt = await payments.charge(order, { idempotencyKey: orderId })
  await notify.customer(order, receipt)
  return receipt
}`;

/** Source line numbers the proposed change adds and removes. */
const DIFF: CodeBlockDiffSpec = { added: [4, 5, 6], removed: [3] };

type Decision = "accepted" | "rejected";

const DECISION_TEXT: Readonly<Record<Decision | "pending", string>> = {
	pending: "Agent proposed this change",
	accepted: "Change applied to the branch",
	rejected: "Change discarded",
};

/*
 * `variant="ghost"` drops the block's own border and background so the Card
 * supplies the chrome exactly once; the zeroed Card padding is what lets the
 * ghost surface sit flush against the footer.
 */
export function CodeBlock22Example(): React.JSX.Element {
	const [decision, setDecision] = React.useState<Decision | null>(null);

	const handleReject = React.useCallback((): void => {
		setDecision("rejected");
	}, []);
	const handleAccept = React.useCallback((): void => {
		setDecision("accepted");
	}, []);
	const handleUndo = React.useCallback((): void => {
		setDecision(null);
	}, []);

	return (
		<Card className="w-full max-w-2xl gap-0 py-0">
			<CardContent className="p-0">
				<CodeBlock code={PATCH} language="typescript" showLineNumbers variant="ghost" diff={DIFF}>
					<CodeBlockHeader>
						<CodeBlockTitle>billing/retry-payment.ts</CodeBlockTitle>
						<div className="ml-auto flex items-center gap-1.5">
							<Badge variant="success-light">+3</Badge>
							<Badge variant="destructive-light">-1</Badge>
						</div>
					</CodeBlockHeader>
				</CodeBlock>
			</CardContent>

			<CardFooter className="border-t border-border bg-muted/40 px-3 py-2!">
				<span className="text-xs text-muted-foreground">{DECISION_TEXT[decision ?? "pending"]}</span>
				<div className="ml-auto flex items-center gap-1.5">
					{decision === null ? (
						<>
							<Button size="sm" variant="outline" onClick={handleReject}>
								Reject
							</Button>
							<Button size="sm" onClick={handleAccept}>
								Accept
							</Button>
						</>
					) : (
						<Button size="sm" variant="ghost" onClick={handleUndo}>
							Undo
						</Button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
}
