import { Search, ShieldCheck, Store } from "lucide-react";
import * as React from "react";

const STEPS: readonly { readonly title: string; readonly description: string; readonly icon: React.ReactNode }[] = [
	{
		title: "Browse as a guest",
		description: "Explore live offers from participating merchants — no account needed to look around.",
		icon: <Search className="size-5" aria-hidden="true" />,
	},
	{
		title: "Sign in to claim",
		description: "Create an account or sign in to save rewards to your wallet and verify with OTP.",
		icon: <ShieldCheck className="size-5" aria-hidden="true" />,
	},
	{
		title: "Redeem in store",
		description: "Open your dashboard, show your QR code at the merchant, and enjoy the reward.",
		icon: <Store className="size-5" aria-hidden="true" />,
	},
];

/** Three-step explainer for the landing page. */
export function LandingHowItWorks(): React.JSX.Element {
	return (
		<section id="how-it-works" className="border-b border-border/80 bg-muted/20 py-14 sm:py-16">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">How Rewardly works</h2>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">Browse freely on the landing page. Your full dashboard unlocks after sign-in.</p>
				</div>
				<ol className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
					{STEPS.map((step, index) => (
						<li key={step.title} className="relative rounded-2xl border border-border bg-card p-5 shadow-xs">
							<span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{step.icon}</span>
							<p className="text-xs font-semibold tracking-wide text-primary uppercase">Step {String(index + 1)}</p>
							<h3 className="mt-1 text-base font-semibold text-foreground">{step.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
