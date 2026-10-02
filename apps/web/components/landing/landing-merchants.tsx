import { Store } from "lucide-react";
import * as React from "react";

export interface LandingMerchantsProps {
	/** Distinct merchants with a live offer, as the page selected them (empty hides the strip). */
	readonly merchantNames: readonly string[];
}

/** First letters of the first two words — a monogram, since merchants have no logos yet. */
function monogramOf(name: string): string {
	return name
		.split(/\s+/)
		.filter((word: string): boolean => /^[\p{L}\p{N}]/u.test(word))
		.slice(0, 2)
		.map((word: string): string => word.charAt(0).toUpperCase())
		.join("");
}

/** "Offers from local favourites" — the real merchants behind today's offers. */
export function LandingMerchants({ merchantNames }: LandingMerchantsProps): React.JSX.Element | null {
	if (merchantNames.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby="landing-merchants-heading" className="border-b border-border/80 py-10">
			<div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
				<h2 id="landing-merchants-heading" className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
					<Store className="size-4 text-primary" aria-hidden="true" />
					Offers from local favourites
				</h2>
				<ul className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
					{merchantNames.map((name: string): React.JSX.Element => (
						<li key={name} className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card py-1 pr-3.5 pl-1 shadow-xs">
							<span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-secondary text-[0.6875rem] font-semibold text-secondary-foreground">
								{monogramOf(name)}
							</span>
							<span className="text-sm font-medium text-foreground">{name}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
