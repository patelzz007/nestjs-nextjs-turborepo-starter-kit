"use client";

import { LandingAuthActions } from "@/components/landing/landing-auth-actions";
import { Gift } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const NAV_LINKS: readonly { readonly label: string; readonly href: string }[] = [
	{ label: "Browse", href: "/#rewards" },
	{ label: "How it works", href: "/#how-it-works" },
];

/** Public marketing header — brand, anchor nav, sign-in / profile. */
export function LandingHeader(): React.JSX.Element {
	return (
		<header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90">
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
							className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
							{link.label}
						</Link>
					))}
				</nav>

				<LandingAuthActions />
			</div>
		</header>
	);
}
