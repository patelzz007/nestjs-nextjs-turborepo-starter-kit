import { LandingShell } from "@/components/landing/landing-shell";
import { landingSectionPath, LANDING_SECTION_IDS } from "@/lib/routes";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import * as React from "react";

export interface PublicRewardDetailFrameProps {
	readonly children: React.ReactNode;
}

/** The public reward page's chrome — landing shell, column and "Back to offers" — shared by the page and its `loading.tsx`. */
export function PublicRewardDetailFrame({ children }: PublicRewardDetailFrameProps): React.JSX.Element {
	return (
		<LandingShell>
			<div className="mx-auto max-w-10xl px-4 py-8 sm:px-6 lg:px-8">
				<Link href={landingSectionPath(LANDING_SECTION_IDS.rewards)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}>
					Back to offers
				</Link>
				{children}
			</div>
		</LandingShell>
	);
}
