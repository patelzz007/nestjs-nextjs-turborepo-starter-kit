import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import * as React from "react";

export interface LandingShellProps {
	readonly children: React.ReactNode;
}

/** Public marketing chrome — sticky header and footer, no dashboard sidebar. */
export function LandingShell({ children }: LandingShellProps): React.JSX.Element {
	return (
		<div className="flex min-h-svh flex-col bg-background text-foreground">
			<LandingHeader />
			<main className="flex-1">{children}</main>
			<LandingFooter />
		</div>
	);
}
