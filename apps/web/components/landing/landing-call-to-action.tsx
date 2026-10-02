import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface LandingCallToActionProps {
	readonly heading: string;
	readonly description: string;
	readonly action: { readonly label: string; readonly href: string };
}

/** Closing call to action — a brand-coloured band. Presentational: the page supplies the copy and the action. */
export function LandingCallToAction({ heading, description, action }: LandingCallToActionProps): React.JSX.Element {
	return (
		<section aria-labelledby="landing-cta-heading" className="bg-muted/30 pb-16 sm:pb-20">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-lg shadow-primary/20 sm:px-12 sm:py-14">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,oklch(from_var(--primary-foreground)_l_c_h_/_0.18)_1px,transparent_0)] mask-[radial-gradient(ellipse_at_center,black,transparent_75%)] bg-size-[22px_22px]"
					/>
					<h2 id="landing-cta-heading" className="mx-auto max-w-2xl font-[family-name:var(--font-heading)] text-3xl font-medium tracking-tight text-balance sm:text-4xl">
						{heading}
					</h2>
					<p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-pretty text-primary-foreground/85 sm:text-base">{description}</p>
					<Link href={action.href} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-8 min-w-48")}>
						{action.label}
						<ArrowRight className="size-4" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	);
}
