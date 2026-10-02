import { Gift } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { landingSectionPath, LANDING_SECTION_IDS, loginPath, ROUTES } from "@/lib/routes";

interface FooterLink {
	readonly label: string;
	readonly href: string;
}

const FOOTER_COLUMNS: readonly { readonly heading: string; readonly links: readonly FooterLink[] }[] = [
	{
		heading: "Explore",
		links: [
			{ label: "Browse offers", href: landingSectionPath(LANDING_SECTION_IDS.rewards) },
			{ label: "How it works", href: landingSectionPath(LANDING_SECTION_IDS.howItWorks) },
		],
	},
	{
		heading: "Your account",
		links: [
			{ label: "Sign in", href: loginPath(ROUTES.rewardHub.browse) },
			{ label: "Dashboard", href: ROUTES.rewardHub.browse },
			{ label: "My rewards", href: ROUTES.rewardHub.wallet },
		],
	},
];

/** Public footer — brand, link columns and the pilot notice. */
export function LandingFooter(): React.JSX.Element {
	return (
		<footer className="border-t border-border/80 bg-card">
			<div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
				<div className="max-w-xs">
					<Link href={ROUTES.home} className="inline-flex items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
						<span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Gift className="size-4" aria-hidden="true" />
						</span>
						<span className="text-sm font-semibold tracking-tight text-foreground">Rewardly</span>
					</Link>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground">Rewards from local cafés, restaurants and shops — claimed online, redeemed in store.</p>
				</div>
				{FOOTER_COLUMNS.map((column) => (
					<nav key={column.heading} aria-label={column.heading}>
						<h2 className="text-xs font-semibold tracking-wide text-foreground uppercase">{column.heading}</h2>
						<ul className="mt-3 space-y-2">
							{column.links.map((link: FooterLink): React.JSX.Element => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				))}
			</div>
			<div className="border-t border-border/80">
				<p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
					© {new Date().getFullYear()} Rewardly · Pilot programme in Kuala Lumpur &amp; Melaka
				</p>
			</div>
		</footer>
	);
}
