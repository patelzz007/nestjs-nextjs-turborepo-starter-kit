"use client";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle, DEFAULT_CODE_BLOCK_LABELS } from "@workspace/ui/components/display/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/navigation/tabs";
import { posEndpointUrl } from "@/lib/pos/pos-endpoint-url";
import { apiRoutes, DEFAULT_SALE_CURRENCY, MAX_CHECKOUT_REWARDS } from "@workspace/shared";
import { Link2, Lock, QrCode, ReceiptText, RefreshCcw, ScanLine } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** The device label used in the examples (any letters, digits, `.`, `_`, `:` or `-`). */
const EXAMPLE_TERMINAL_ID = "FRONT-COUNTER-01";
/** RM 25.00 in sen — the example bill. */
const EXAMPLE_BILL_MINOR = 2500;

type SnippetId = "validate" | "checkout";

function curl(url: string, body: string): string {
	return [
		`curl -X POST ${url} \\`,
		`  -H "X-API-Key: <your-terminal-key>" \\`,
		`  -H "X-Terminal-Id: ${EXAMPLE_TERMINAL_ID}" \\`,
		`  -H "Content-Type: application/json" \\`,
		`  -d '${body}'`,
	].join("\n");
}

/** Step 2 — the request a terminal sends when the customer shows their QR code. */
export function buildValidateRedemptionSnippet(apiBaseUrl: string): string {
	return curl(posEndpointUrl(apiBaseUrl, apiRoutes.redemptions.validate), `{"token": "<QR token shown by the customer>"}`);
}

/** Step 3 — after payment: the bill total plus every reward redeemed on it. */
export function buildCheckoutSnippet(apiBaseUrl: string): string {
	const body = JSON.stringify(
		{
			idempotencyKey: "<new UUID for this bill>",
			billTotalMinor: EXAMPLE_BILL_MINOR,
			currency: DEFAULT_SALE_CURRENCY,
			codes: [{ token: "<QR token>" }, { backupCode: "ABCD2345" }],
		},
		null,
		2,
	);
	return curl(posEndpointUrl(apiBaseUrl, apiRoutes.redemptions.checkout), body);
}

interface Step {
	readonly id: string;
	readonly icon: React.ReactNode;
	readonly title: string;
	readonly body: React.ReactNode;
}

/** Steps 2 and 3 — the same for every organization. */
const REQUEST_STEPS: readonly Step[] = [
	{
		id: "validate",
		icon: <QrCode className="size-4" aria-hidden="true" />,
		title: "Check the code before payment",
		body: "Scan the QR (or type the backup code). The answer says whether it can be used here — and the reward's minimum bill.",
	},
	{
		id: "checkout",
		icon: <ReceiptText className="size-4" aria-hidden="true" />,
		title: "After payment, check out",
		body: `Send the bill total in sen and up to ${String(MAX_CHECKOUT_REWARDS)} of the customer's codes. All rewards are deducted together — or none are.`,
	},
];

/** Step 1 links to the POS terminals page, so the steps are built per organization. */
function buildSteps(terminalsHref: string): readonly Step[] {
	return [
		{
			id: "pair",
			icon: <Link2 className="size-4" aria-hidden="true" />,
			title: "Pair the till",
			body: (
				<>
					Add the till on{" "}
					<Link href={terminalsHref} className="font-medium text-primary underline-offset-4 hover:underline">
						POS terminals
					</Link>{" "}
					then enter the one-time code on the till — it receives its own key. Keys created on this page remain for server-to-server integrations: send them as the{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">X-API-Key</code> header, with an <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Terminal-Id</code>{" "}
					naming the device.
				</>
			),
		},
		...REQUEST_STEPS,
	];
}

const TIPS: readonly { readonly icon: React.ReactNode; readonly text: string }[] = [
	{ icon: <ScanLine className="size-4" aria-hidden="true" />, text: "One key per terminal — revoke a single device without touching the others." },
	{ icon: <RefreshCcw className="size-4" aria-hidden="true" />, text: "Network hiccup? Retry with the same idempotency key — the bill is never deducted twice." },
	{ icon: <Lock className="size-4" aria-hidden="true" />, text: "Keep keys on the till or your server — never in a website or app the public can open." },
];

export interface ApiKeyIntegrationGuideProps {
	/** The API's public origin (e.g. `https://api.example.com`). */
	readonly apiBaseUrl: string;
	/** This organization's POS terminals page (`orgRoutes(slug).terminals`), where tills are paired. */
	readonly terminalsHref: string;
}

/** How a terminal uses its key: the three POS steps beside the real requests. Presentational. */
export function ApiKeyIntegrationGuide({ apiBaseUrl, terminalsHref }: ApiKeyIntegrationGuideProps): React.JSX.Element {
	const snippets: Readonly<Record<SnippetId, string>> = React.useMemo(
		() => ({ validate: buildValidateRedemptionSnippet(apiBaseUrl), checkout: buildCheckoutSnippet(apiBaseUrl) }),
		[apiBaseUrl],
	);
	const steps = React.useMemo((): readonly Step[] => buildSteps(terminalsHref), [terminalsHref]);

	return (
		<section aria-labelledby="api-key-guide-heading" className="rounded-xl border border-border bg-card shadow-xs">
			<div className="border-b border-border px-5 py-4 sm:px-6">
				<h2 id="api-key-guide-heading" className="text-base font-semibold text-foreground">
					Connect a terminal
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Three steps from your point-of-sale: pair the till, check the customer&apos;s code, then check out once they&apos;ve paid.
				</p>
			</div>

			<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
				<ol className="space-y-5">
					{steps.map((step, index): React.JSX.Element => (
						<li key={step.id} className="flex gap-4">
							<span
								aria-hidden="true"
								className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary tabular-nums">
								{index + 1}
							</span>
							<div className="min-w-0 space-y-1 pt-1">
								<p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
									<span className="text-primary">{step.icon}</span>
									{step.title}
								</p>
								<p className="text-sm text-muted-foreground">{step.body}</p>
							</div>
						</li>
					))}
				</ol>

				<Tabs defaultValue="validate" className="min-w-0">
					<TabsList aria-label="Example requests">
						<TabsTrigger value="validate">2 · Check a code</TabsTrigger>
						<TabsTrigger value="checkout">3 · Check out</TabsTrigger>
					</TabsList>
					<TabsContent value="validate">
						<GuideSnippet code={snippets.validate} title="POST /redemptions/validate" />
					</TabsContent>
					<TabsContent value="checkout">
						<GuideSnippet code={snippets.checkout} title="POST /redemptions/checkout" />
					</TabsContent>
				</Tabs>
			</div>

			<ul className="grid gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:grid-cols-3 sm:px-6">
				{TIPS.map((tip): React.JSX.Element => (
					<li key={tip.text} className="flex gap-2.5 text-xs text-muted-foreground">
						<span className="mt-0.5 text-primary">{tip.icon}</span>
						{tip.text}
					</li>
				))}
			</ul>
		</section>
	);
}

interface GuideSnippetProps {
	readonly code: string;
	readonly title: string;
}

function GuideSnippet({ code, title }: GuideSnippetProps): React.JSX.Element {
	return (
		<CodeBlock code={code} language="bash" labels={DEFAULT_CODE_BLOCK_LABELS} label={title} className="mt-2">
			<CodeBlockHeader>
				<CodeBlockTitle>{title}</CodeBlockTitle>
				<CodeBlockLanguage>bash</CodeBlockLanguage>
				<div className="ms-auto flex items-center gap-1">
					<CodeBlockCopyButton />
				</div>
			</CodeBlockHeader>
		</CodeBlock>
	);
}
