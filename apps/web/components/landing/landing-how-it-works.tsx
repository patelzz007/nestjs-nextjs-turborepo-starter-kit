import { cn } from "@workspace/ui/lib/core/utils";
import { QrCode, Search, ShieldCheck } from "lucide-react";
import * as React from "react";
import { LANDING_SECTION_IDS } from "@/lib/routes";

interface Step {
	readonly title: string;
	readonly description: string;
	readonly icon: React.ReactNode;
}

const HEADING_ID = `${LANDING_SECTION_IDS.howItWorks}-heading`;

const STEPS: readonly Step[] = [
	{
		title: "Browse as a guest",
		description: "Explore live offers from participating merchants — no account needed to look around.",
		icon: <Search className="size-5" aria-hidden="true" />,
	},
	{
		title: "Sign in to claim",
		description: "Create a free account, verify with a one-time code, and the reward lands in your wallet.",
		icon: <ShieldCheck className="size-5" aria-hidden="true" />,
	},
	{
		title: "Redeem in store",
		description: "Show the QR code from your wallet at the counter before it expires. That's it.",
		icon: <QrCode className="size-5" aria-hidden="true" />,
	},
];

/** Three-step explainer — numbered cards; the last (the payoff) in the brand colour. */
export function LandingHowItWorks(): React.JSX.Element {
	return (
		<section id={LANDING_SECTION_IDS.howItWorks} aria-labelledby={HEADING_ID} className="scroll-mt-20 border-t border-border/80 bg-muted/30 py-20 sm:py-24">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="max-w-2xl">
					<p className="text-xs font-semibold tracking-wide text-primary uppercase">How it works</p>
					<h2 id={HEADING_ID} className="mt-2 font-[family-name:var(--font-heading)] text-4xl font-medium tracking-tight text-balance text-foreground sm:text-5xl">
						From browsing to redeemed in three steps
					</h2>
				</div>

				<ol className="mt-12 grid gap-5 md:grid-cols-3">
					{STEPS.map((step: Step, index: number): React.JSX.Element => {
						const isPayoff = index === STEPS.length - 1;
						return (
							<li
								key={step.title}
								className={cn(
									"relative isolate overflow-hidden rounded-3xl border p-7 shadow-xs",
									isPayoff ? "border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "border-border/80 bg-card",
								)}>
								<span
									aria-hidden="true"
									className={cn(
										"absolute -top-3 right-4 -z-10 font-[family-name:var(--font-heading)] text-8xl leading-none font-medium tabular-nums",
										isPayoff ? "text-primary-foreground/15" : "text-primary/10",
									)}>
									{String(index + 1).padStart(2, "0")}
								</span>
								<span
									className={cn(
										"flex size-11 items-center justify-center rounded-2xl",
										isPayoff ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary",
									)}>
									{step.icon}
								</span>
								<p className={cn("mt-8 text-xs font-semibold tracking-wide uppercase", isPayoff ? "text-primary-foreground/80" : "text-primary")}>Step {index + 1}</p>
								<h3 className={cn("mt-1 text-lg font-semibold", isPayoff ? "text-primary-foreground" : "text-foreground")}>{step.title}</h3>
								<p className={cn("mt-2 text-sm leading-relaxed text-pretty", isPayoff ? "text-primary-foreground/85" : "text-muted-foreground")}>{step.description}</p>
							</li>
						);
					})}
				</ol>
			</div>
		</section>
	);
}
