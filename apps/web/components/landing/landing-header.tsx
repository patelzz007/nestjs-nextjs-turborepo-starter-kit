"use client";

import { LandingAuthActions } from "@/components/landing/landing-auth-actions";
import { useScrolledPast } from "@/components/landing/use-scrolled-past";
import { cn } from "@workspace/ui/lib/core/utils";
import { Gift } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { landingSectionPath, LANDING_SECTION_IDS, ROUTES } from "@/lib/routes";

const NAV_LINKS: readonly { readonly label: string; readonly href: string }[] = [
	{ label: "Offers", href: landingSectionPath(LANDING_SECTION_IDS.rewards) },
	{ label: "How it works", href: landingSectionPath(LANDING_SECTION_IDS.howItWorks) },
];

/** Scroll distance after which the header detaches from the hero. */
const HEADER_DETACH_SCROLL_PX = 8;

/**
 * Public marketing header — brand, anchor nav, sign-in / profile.
 *
 * At the top of the page it is transparent and borderless, so it reads as part
 * of the hero (which extends up beneath it). Once the page scrolls it gains a
 * frosted background, a border and a shadow, separating from the content.
 */
export function LandingHeader(): React.JSX.Element {
	const isDetached = useScrolledPast(HEADER_DETACH_SCROLL_PX);

	return (
		<header
			data-detached={isDetached ? "" : undefined}
			className={cn(
				"sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none",
				isDetached ? "border-border/80 bg-background/80 shadow-sm backdrop-blur-md" : "border-transparent bg-transparent",
			)}>
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<Link
					href={ROUTES.home}
					className="flex min-w-0 items-center gap-2.5 rounded-md transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
						<Gift className="size-4" aria-hidden="true" />
					</div>
					<div className="min-w-0 leading-tight">
						<span className="block truncate text-sm font-semibold tracking-tight text-foreground">Rewardly</span>
						<span className="hidden text-xs text-muted-foreground sm:block">Local rewards, claimed fast</span>
					</div>
				</Link>

				<nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
							{link.label}
						</Link>
					))}
				</nav>

				<LandingAuthActions />
			</div>
		</header>
	);
}
