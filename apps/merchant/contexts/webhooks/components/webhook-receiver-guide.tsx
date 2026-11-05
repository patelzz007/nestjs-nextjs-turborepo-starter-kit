"use client";

import { buildWebhookReceiverSnippet } from "@/contexts/webhooks/lib/webhook-receiver-snippet";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@workspace/ui/components/code-block";
import { Clock, Fingerprint, Repeat } from "lucide-react";
import * as React from "react";

const FACTS: readonly { readonly icon: React.ReactNode; readonly title: string; readonly body: string }[] = [
	{
		icon: <Fingerprint className="size-4" aria-hidden="true" />,
		title: "Check the signature",
		body: 'Every request carries Webhook-Signature: t=<time>,v1=<HMAC-SHA256 of "<time>.<body>">. Refuse anything that doesn\'t match.',
	},
	{
		icon: <Repeat className="size-4" aria-hidden="true" />,
		title: "Expect repeats",
		body: "A delivery that fails is tried again with the same Webhook-Id. Skip an id you have already handled.",
	},
	{
		icon: <Clock className="size-4" aria-hidden="true" />,
		title: "Answer quickly",
		body: "Reply with any 2xx status within 10 seconds, then do the slow work. Anything else counts as a failure.",
	},
];

/** The receiver example: the same for every tenant, so built once. */
const RECEIVER_SNIPPET = buildWebhookReceiverSnippet();

/** How an integrator's server receives and checks a delivery. The same for every tenant. */
export function WebhookReceiverGuide(): React.JSX.Element {
	return (
		<section aria-labelledby="webhook-guide-heading" className="overflow-hidden rounded-xl border border-border bg-card">
			<div className="border-b border-border px-5 py-4 sm:px-6">
				<h2 id="webhook-guide-heading" className="text-base font-semibold text-foreground">
					Receiving webhooks on your server
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">Each event is a JSON POST to your endpoint. Check it came from us before you trust it.</p>
			</div>
			<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-8">
				<ul className="space-y-5">
					{FACTS.map((fact) => (
						<li key={fact.title} className="space-y-1">
							<p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
								<span className="text-primary">{fact.icon}</span>
								{fact.title}
							</p>
							<p className="text-sm text-muted-foreground">{fact.body}</p>
						</li>
					))}
				</ul>
				<CodeBlock code={RECEIVER_SNIPPET} language="javascript" label="Example receiver" className="min-w-0">
					<CodeBlockHeader>
						<CodeBlockTitle>receiver.mjs</CodeBlockTitle>
						<CodeBlockLanguage>javascript</CodeBlockLanguage>
						<div className="ms-auto flex items-center gap-1">
							<CodeBlockCopyButton />
						</div>
					</CodeBlockHeader>
				</CodeBlock>
			</div>
		</section>
	);
}
