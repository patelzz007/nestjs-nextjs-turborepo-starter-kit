"use client";

import { stubPaginatedMeta } from "@/lib/api-envelope";
import { WebEmptyState } from "@/components/web-ui/empty-state";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebStatCard } from "@/components/web-ui/stat-card";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardClaimResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { Gift, QrCode, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const CLAIMS_PAGE = 1;
const CLAIMS_LIMIT = 20;

export interface MyClaimsPageViewProps {
	readonly initialClaims?: readonly RewardClaimResponse[];
}

/** List of the signed-in user's reward claims. */
export function MyClaimsPageView({ initialClaims }: MyClaimsPageViewProps): React.JSX.Element {
	const { api } = useAuth();

	const initialQueryData = React.useMemo(
		() =>
			initialClaims !== undefined
				? {
						success: true as const,
						data: [...initialClaims],
						meta: stubPaginatedMeta(initialClaims.length, CLAIMS_PAGE, CLAIMS_LIMIT),
					}
				: undefined,
		[initialClaims],
	);

	const claimsQuery = api.claims.list.useQuery(
		{ page: CLAIMS_PAGE, limit: CLAIMS_LIMIT },
		{
			initialData: initialQueryData,
		},
	);
	const claims: readonly RewardClaimResponse[] = claimsQuery.data?.data ?? [];
	const isLoading = claimsQuery.isLoading && initialClaims === undefined;

	const pendingCount = claims.filter((claim) => claim.status === "PENDING").length;

	return (
		<div className="space-y-8">
			<WebPageHeader title="My rewards" description="Active claims ready for redemption at the merchant." />

			<div className="grid gap-4 sm:grid-cols-2">
				<WebStatCard label="Total claims" value={String(claims.length)} hint="On this account" icon={<Ticket className="size-4" aria-hidden="true" />} />
				<WebStatCard label="Ready to redeem" value={String(pendingCount)} hint="Show QR at checkout" icon={<QrCode className="size-4" aria-hidden="true" />} />
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading claims…</p>
			) : claims.length === 0 ? (
				<WebEmptyState
					title="No claims yet"
					description="Browse local rewards and claim your first offer — it will appear here with a QR code for redemption."
					icon={<Gift className="size-5" aria-hidden="true" />}
					action={
						<Link href="/" className={cn(buttonVariants())}>
							Browse rewards
						</Link>
					}
				/>
			) : (
				<div className="space-y-3">
					{claims.map((claim) => (
						<WebSurfacePanel key={claim.id} accent={claim.status === "PENDING"} className="px-5 py-4">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{claim.rewardTitle}</p>
									<p className="text-sm text-muted-foreground">Claimed {format(new Date(claim.claimedAt), "d MMM yyyy · HH:mm")}</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">{claim.status}</Badge>
									{claim.status === "PENDING" ? (
										<Link href={`/rewardhub/claims/${claim.id}`} className={cn(buttonVariants())}>
											Show QR
										</Link>
									) : null}
								</div>
							</div>
						</WebSurfacePanel>
					))}
				</div>
			)}
		</div>
	);
}
