"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { CustomerTier } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Lock } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useWebSession } from "@/contexts/identity";
import { lockedRewardMessage, type LockedRewardViewer } from "@/contexts/tiers/lib/locked-reward-message";
import { loginPath, ROUTES } from "@/lib/routes";

export interface LockedRewardPanelProps {
	/** The reward's minimum tier, above the viewer's. */
	readonly minimumTier: CustomerTier;
	/** The viewer's tier (`GET /tiers/availability`; Bronze when signed out). */
	readonly viewerTier: CustomerTier;
	/** Where signing in returns to. */
	readonly returnTo: string;
}

/**
 * What a locked reward's page shows where the Claim button would be (ADR 085): the reward's tier and how far the
 * customer is from it, with a way to their tier page — or, signed out, to sign in. A locked reward never offers a claim.
 */
export function LockedRewardPanel({ minimumTier, viewerTier, returnTo }: LockedRewardPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const { isAuthenticated } = useWebSession();
	const tierPage = api.tiers.me.useQuery(undefined, { enabled: isAuthenticated });
	const viewer: LockedRewardViewer = isAuthenticated ? { kind: "signed-in", tier: viewerTier, page: tierPage.data?.data ?? null } : { kind: "signed-out" };

	return (
		<div className="space-y-3" data-slot="locked-reward">
			<p className="flex items-start gap-2 text-sm text-muted-foreground">
				<Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
				<span>{lockedRewardMessage(minimumTier, viewer)}</span>
			</p>
			{isAuthenticated ? (
				<Link href={ROUTES.dashboard.tier} className={cn(buttonVariants({ variant: "outline" }))}>
					See my tier
				</Link>
			) : (
				<Link href={loginPath(returnTo)} className={cn(buttonVariants({ variant: "default" }))}>
					Sign in
				</Link>
			)}
		</div>
	);
}
