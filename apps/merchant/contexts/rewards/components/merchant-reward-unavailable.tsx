"use client";

import { userSafeErrorMessage } from "@/lib/query/query-policy";
import type { MerchantRewardState } from "@/contexts/rewards/lib/use-merchant-reward";
import type { AppPath } from "@/lib/routes";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card } from "@workspace/ui/components/card";
import Link from "next/link";
import * as React from "react";

const REWARD_LOAD_FAILED_MESSAGE = "This reward could not be loaded. Try again.";

export interface MerchantRewardUnavailableProps {
	/** Why there is no reward to show: the read failed, or the tenant has no such reward. */
	readonly state: Extract<MerchantRewardState, { readonly kind: "failed" | "missing" }>;
	readonly rewardsHref: AppPath;
}

/**
 * The reward page or editor when there is no reward to show. A failed read
 * offers a retry (and never says "not found"); a missing reward points back
 * to the catalog.
 */
export function MerchantRewardUnavailable({ state, rewardsHref }: MerchantRewardUnavailableProps): React.JSX.Element {
	return (
		<Card className="items-start gap-3 px-6 py-8">
			{state.kind === "failed" ? (
				<>
					<h1 className="text-xl font-semibold tracking-tight text-foreground">Could not load this reward</h1>
					<p role="alert" className="text-sm text-muted-foreground">
						{userSafeErrorMessage(state.error, REWARD_LOAD_FAILED_MESSAGE)}
					</p>
					<Button type="button" onClick={state.retry}>
						Try again
					</Button>
				</>
			) : (
				<>
					<h1 className="text-xl font-semibold tracking-tight text-foreground">Reward not found</h1>
					<p className="text-sm text-muted-foreground">{"It may have been removed, or your role can't see it."}</p>
					<Link href={rewardsHref} className={cn(buttonVariants({ variant: "outline" }))}>
						Back to rewards
					</Link>
				</>
			)}
		</Card>
	);
}
