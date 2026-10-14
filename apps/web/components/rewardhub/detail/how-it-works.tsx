import * as React from "react";

/** The three steps from claiming an offer to using it — the same for every reward. */
const STEPS: readonly { readonly title: string; readonly body: string }[] = [
	{ title: "Claim it here", body: "Confirm your mobile number with a one-time code. The offer is held for you straight away." },
	{ title: "Find it in your wallet", body: "Your claimed offers live in your wallet, each with its own QR code and a backup code." },
	{ title: "Show it before you pay", body: "At the counter, show the QR code (or read out the backup code) and the cashier applies the offer to your bill." },
];

/** How a claimed offer is used — answers "what happens after I claim?" before the visitor asks. */
export function RewardHowItWorks(): React.JSX.Element {
	return (
		<section aria-labelledby="reward-how-it-works" className="space-y-4">
			<h2 id="reward-how-it-works" className="text-lg font-semibold tracking-tight">
				How it works
			</h2>
			<ol className="grid gap-3 sm:grid-cols-3">
				{STEPS.map((step, index) => (
					<li key={step.title} className="rounded-xl border border-border bg-card p-4">
						<span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
							{index + 1}
						</span>
						<p className="mt-3 text-sm font-semibold text-foreground">{step.title}</p>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
					</li>
				))}
			</ol>
		</section>
	);
}
