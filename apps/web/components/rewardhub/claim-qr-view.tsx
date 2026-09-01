"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardClaimQrResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { QrCode } from "@workspace/ui/components/display/qr-code";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";

export interface ClaimQrViewProps {
	readonly claimId: string;
	readonly initialQr?: RewardClaimQrResponse;
}

/** Active claim redemption QR + backup code display. */
export function ClaimQrView({ claimId, initialQr }: ClaimQrViewProps): React.JSX.Element {
	const { api } = useAuth();

	const initialQueryData = React.useMemo(
		() =>
			initialQr !== undefined
				? {
						success: true as const,
						data: initialQr,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialQr],
	);

	const qrQuery = api.claims.qr.useQuery(
		{ claimId },
		{
			initialData: initialQueryData,
		},
	);
	const qr = qrQuery.data?.data;

	const handleRefresh = React.useCallback((): void => {
		void qrQuery.refetch();
	}, [qrQuery]);

	if (qrQuery.isLoading && initialQr === undefined) {
		return <p className="text-sm text-muted-foreground">Loading redemption code…</p>;
	}

	if (qr === undefined) {
		return (
			<div className="space-y-6">
				<WebPageHeader title="Claim unavailable" description="This claim may have expired or already been redeemed." />
				<Link href="/rewardhub/claims" className={cn(buttonVariants({ variant: "outline" }))}>
					Back to my rewards
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg space-y-8">
			<WebPageHeader title="Show at checkout" description="Let the cashier scan your QR code, or read out the backup code if scanning fails." />

			<Link href="/rewardhub/claims" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mt-4")}>
				← My rewards
			</Link>

			<WebSurfacePanel accent className="p-5 sm:p-6">
				<div className="mb-6 flex flex-col items-center gap-3 text-center">
					<QrCode value={qr.qrPayload} size={220} label="Reward redemption QR code" />
					<p className="text-sm text-muted-foreground">Position this code within the scanner at the till</p>
				</div>

				<div className="space-y-4">
					<div className="rounded-lg border border-primary/30 bg-background p-4 text-center">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Backup code</p>
						<p className="mt-2 text-2xl font-semibold tracking-widest text-foreground">{qr.backupCode}</p>
						<p className="mt-1 text-xs text-muted-foreground">If the scanner fails, read this aloud</p>
					</div>
					<details className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
						<summary className="cursor-pointer text-xs font-medium tracking-wide text-muted-foreground uppercase">Manual payload</summary>
						<p className="mt-3 font-mono text-xs break-all text-foreground">{qr.qrPayload}</p>
					</details>
					<p className="text-sm text-muted-foreground">Valid until {format(new Date(qr.claimExpiresAt), "d MMM yyyy · HH:mm")}</p>
					<Button variant="outline" onClick={handleRefresh} disabled={qrQuery.isFetching} className="w-full sm:w-auto">
						{qrQuery.isFetching ? "Refreshing…" : "Refresh code"}
					</Button>
				</div>
			</WebSurfacePanel>
		</div>
	);
}
