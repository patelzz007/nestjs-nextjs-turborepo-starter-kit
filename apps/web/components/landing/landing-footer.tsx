import Link from "next/link";
import * as React from "react";

/** Minimal public footer. */
export function LandingFooter(): React.JSX.Element {
	return (
		<footer className="border-t border-border/80 bg-card">
			<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-left lg:px-8">
				<p>© {new Date().getFullYear()} Rewardly. Pilot programme — KL & Melaka.</p>
				<div className="flex flex-wrap items-center justify-center gap-4">
					<Link href="/auth/login?redirect=%2Frewardhub" className="font-medium text-foreground/80 transition-colors hover:text-foreground">
						Sign in
					</Link>
					<Link href="/rewardhub" className="font-medium text-foreground/80 transition-colors hover:text-foreground">
						Dashboard
					</Link>
				</div>
			</div>
		</footer>
	);
}
