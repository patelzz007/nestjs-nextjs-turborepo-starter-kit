"use client";

import { PAIR_TERMINAL_SNIPPET_TITLE, PairTerminalSnippet } from "@/components/terminals/pair-terminal-snippet";
import { POS_PAIRING_CODE_TTL_MS } from "@workspace/shared";
import { CheckCircle2, KeyRound, Plus } from "lucide-react";
import * as React from "react";

const MS_PER_MINUTE = 60_000;
const PAIRING_CODE_TTL_MINUTES = POS_PAIRING_CODE_TTL_MS / MS_PER_MINUTE;

interface GuideStep {
	readonly id: string;
	readonly icon: React.ReactNode;
	readonly title: string;
	readonly body: React.ReactNode;
}

const STEPS: readonly GuideStep[] = [
	{
		id: "add",
		icon: <Plus className="size-4" aria-hidden="true" />,
		title: "Add the terminal here",
		body: `Name the till and pick its store. You get a one-time code, valid for ${String(PAIRING_CODE_TTL_MINUTES)} minutes.`,
	},
	{
		id: "enter",
		icon: <KeyRound className="size-4" aria-hidden="true" />,
		title: "Enter the code on the till",
		body: (
			<>
				The till sends it once to <code className="rounded bg-muted px-1 py-0.5 text-xs">{PAIR_TERMINAL_SNIPPET_TITLE}</code> — no key needed for this call.
			</>
		),
	},
	{
		id: "ready",
		icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
		title: "The till is ready",
		body: (
			<>
				It receives its own API key, bound to this terminal. From then on it sends just <code className="rounded bg-muted px-1 py-0.5 text-xs">X-API-Key</code> to validate and
				check out redemptions.
			</>
		),
	},
];

export interface TerminalPairingGuideProps {
	/** The API's public origin (e.g. `https://api.example.com`). */
	readonly apiBaseUrl: string;
}

/** "How pairing works": three steps beside the till's one pairing request. Presentational. */
export function TerminalPairingGuide({ apiBaseUrl }: TerminalPairingGuideProps): React.JSX.Element {
	return (
		<section aria-labelledby="terminal-guide-heading" className="rounded-xl border border-border bg-card shadow-xs">
			<div className="border-b border-border px-5 py-4 sm:px-6">
				<h2 id="terminal-guide-heading" className="text-base font-semibold text-foreground">
					How pairing works
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">No keys to copy onto devices: each till exchanges a short-lived code for its own key.</p>
			</div>

			<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
				<ol className="space-y-5">
					{STEPS.map((step, index): React.JSX.Element => (
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

				<div className="min-w-0 space-y-2">
					<p className="text-sm font-medium text-foreground">The till&apos;s pairing request</p>
					<PairTerminalSnippet apiBaseUrl={apiBaseUrl} />
				</div>
			</div>
		</section>
	);
}
