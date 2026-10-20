"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { ClaimQrCodeSlotSkeleton, ClaimQrSkeleton } from "@/components/loading/claim-qr-skeleton";
import { CLAIM_QR_LOADING_LABELS } from "@/components/loading/loading-labels";
import { CLAIM_QR_SIZE_PX } from "@/contexts/claims/components/claim-qr-layout";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { claimStatusBadge } from "@/contexts/claims/lib/claim-status-badge";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PLATFORM_DISPLAY_REGION, type Envelope, type RewardClaimQrResponse, type RewardClaimResponse, type RewardClaimStatus } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { QrCode } from "@workspace/ui/components/qr-code";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import Link from "next/link";
import * as React from "react";
import { ROUTES } from "@/lib/routes";

export interface ClaimQrViewProps {
	readonly claimId: string;
	/** The claim the server render prefetched (`claims.get`) — seeds the query, so the card is in the HTML. */
	readonly initialClaim?: Envelope<RewardClaimResponse> | undefined;
}

/** Why a claim that is no longer PENDING has no code to show. */
const SETTLED_CLAIM_DESCRIPTIONS: Readonly<Record<Exclude<RewardClaimStatus, "PENDING">, string>> = {
	REDEEMED: "This claim was already redeemed.",
	EXPIRED: "This claim has expired.",
};

/** Shown when the claim or its codes cannot be had (signed out, not the holder's, gone, or no longer PENDING). */
const UNAVAILABLE_DESCRIPTION = "This claim may have expired or already been redeemed.";

function ClaimUnavailable({ description }: { readonly description: string }): React.JSX.Element {
	return (
		<div className="space-y-6">
			<WebPageHeader title="Claim unavailable" description={description} />
			<Link href={ROUTES.dashboard.wallet} className={cn(buttonVariants({ variant: "outline" }))}>
				Back to My Wallet
			</Link>
		</div>
	);
}

/** The issued redemption codes: the QR, the backup code read aloud when scanning fails, and the raw payload. */
function ClaimQrCodes({ codes }: { readonly codes: RewardClaimQrResponse }): React.JSX.Element {
	return (
		<div className="space-y-4">
			<div className="mb-6 flex flex-col items-center gap-3 text-center">
				<QrCode value={codes.qrPayload} size={CLAIM_QR_SIZE_PX} label="Reward redemption QR code" />
				<p className="text-sm text-muted-foreground">Position this code within the scanner at the till</p>
			</div>
			<div className="rounded-lg border border-primary/30 bg-background p-4 text-center">
				<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Backup code</p>
				<p className="mt-2 text-2xl font-semibold tracking-widest text-foreground">{codes.backupCode}</p>
				<p className="mt-1 text-xs text-muted-foreground">If the scanner fails, read this aloud</p>
			</div>
			<details className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
				<summary className="cursor-pointer text-xs font-medium tracking-wide text-muted-foreground uppercase">Manual payload</summary>
				<p className="mt-3 font-mono text-xs break-all text-foreground">{codes.qrPayload}</p>
			</details>
		</div>
	);
}

/**
 * A claim's redemption page. The claim card (title, status, expiry) comes from
 * the `claims.get` read model the server render prefetched. The codes come from
 * the `claims.qr` COMMAND, which rotates the stored code hashes — so it runs
 * only in the browser, once on mount, and only while the claim is PENDING; a
 * server render, a link prefetch or a re-render never issues codes. The
 * "Refresh code" button issues a fresh pair on demand.
 *
 * The back link names the parent breadcrumb (`My Wallet`); the heading reads
 * "Show at checkout" like the final crumb.
 */
export function ClaimQrView({ claimId, initialClaim }: ClaimQrViewProps): React.JSX.Element {
	const { api } = useAuth();

	const claimQuery = api.claims.get.useQuery({ claimId }, initialDataOption(initialClaim));
	const claim = claimQuery.data?.data;
	const qrMutation = api.claims.qr.useMutation();
	const { mutate: issueCodes } = qrMutation;
	const codes = qrMutation.data?.data;
	const isPending = claim?.status === "PENDING";

	// React StrictMode mounts, unmounts and re-mounts every component in development, keeping its
	// refs: the flag makes that second mount a no-op, so opening the page rotates the codes ONCE.
	const issuedOnMountRef = React.useRef(false);
	React.useEffect((): void => {
		if (!isPending || issuedOnMountRef.current) {
			return;
		}
		issuedOnMountRef.current = true;
		issueCodes({ claimId });
	}, [claimId, isPending, issueCodes]);

	const handleRefresh = React.useCallback((): void => {
		issueCodes({ claimId });
	}, [claimId, issueCodes]);

	if (claimQuery.isLoading && initialClaim === undefined) {
		return <ClaimQrSkeleton />;
	}

	if (claim === undefined || qrMutation.isError) {
		return <ClaimUnavailable description={UNAVAILABLE_DESCRIPTION} />;
	}

	if (claim.status !== "PENDING") {
		return <ClaimUnavailable description={SETTLED_CLAIM_DESCRIPTIONS[claim.status]} />;
	}

	const statusBadge = claimStatusBadge(claim.status);

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<WebPageHeader title="Show at checkout" description="Let the cashier scan your QR code, or read out the backup code if scanning fails." />

			<Link href={ROUTES.dashboard.wallet} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mt-4")}>
				Back to My Wallet
			</Link>

			<Card className="gap-0 p-5 sm:p-6">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<p className="min-w-0 font-medium text-foreground">{claim.rewardTitle}</p>
					<StatusBadge tone={statusBadge.tone}>{statusBadge.label}</StatusBadge>
				</div>

				{codes === undefined ? (
					<SkeletonRegion labels={CLAIM_QR_LOADING_LABELS}>
						<ClaimQrCodeSlotSkeleton />
					</SkeletonRegion>
				) : (
					<ClaimQrCodes codes={codes} />
				)}

				<div className="mt-4 space-y-4">
					<p className="text-sm text-muted-foreground">Valid until {formatEpochMs(claim.claimExpiresAt, "dateTime", PLATFORM_DISPLAY_REGION)}</p>
					<Button variant="outline" onClick={handleRefresh} disabled={qrMutation.isPending} className="w-full sm:w-auto">
						{qrMutation.isPending ? "Refreshing…" : "Refresh code"}
					</Button>
				</div>
			</Card>
		</div>
	);
}
