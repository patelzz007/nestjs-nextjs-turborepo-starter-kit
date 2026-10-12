import { Users } from "lucide-react";
import * as React from "react";

export interface TeamInvitePageFrameProps {
	readonly children: React.ReactNode;
}

/** The team-invitation page's chrome — background, brand header and footer — around the invitation card (or its skeleton). */
export function TeamInvitePageFrame({ children }: TeamInvitePageFrameProps): React.JSX.Element {
	return (
		<div className="relative min-h-svh overflow-x-hidden bg-background">
			<div className="merchant-grid-bg-subtle pointer-events-none absolute inset-0" aria-hidden="true" />
			<div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-primary/6 blur-3xl" aria-hidden="true" />
			<div className="pointer-events-none absolute bottom-0 left-0 size-72 rounded-full bg-chart-2/6 blur-3xl" aria-hidden="true" />

			<div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
				<header className="mb-8 flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
						<Users className="size-5" aria-hidden="true" />
					</div>
					<div>
						<p className="text-sm font-semibold text-foreground">Reward Hub</p>
						<p className="text-xs text-muted-foreground">Team invitation</p>
					</div>
				</header>

				<main className="flex flex-1 flex-col justify-center pb-8">{children}</main>

				<footer className="pt-2 text-center text-xs text-muted-foreground sm:text-left">&copy; {new Date().getFullYear()} Reward Hub. All rights reserved.</footer>
			</div>
		</div>
	);
}
