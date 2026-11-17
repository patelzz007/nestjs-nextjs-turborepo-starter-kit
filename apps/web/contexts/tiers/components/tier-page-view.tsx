import {
	CUSTOMER_TIER_LABELS,
	PLATFORM_DISPLAY_REGION,
	tierThreshold,
	type CustomerTierChange,
	type MyTier,
	type TierDropOff,
	type TierMerchantCount,
} from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import * as React from "react";

import { WebPageHeader } from "@/components/web-ui/page-header";
import { TierBadge } from "@workspace/client/lib/contexts/tiers";

const FULL_PERCENT = 100;

/** How far the customer is from their tier to the next one, as a percentage (100 at Diamond). */
export function tierProgressPercent(page: Pick<MyTier, "tier" | "nextTier" | "countedRedemptions" | "rules">): number {
	if (page.nextTier === null) {
		return FULL_PERCENT;
	}
	const from = tierThreshold(page.rules, page.tier);
	const to = tierThreshold(page.rules, page.nextTier);
	return Math.min(FULL_PERCENT, Math.max(0, Math.round(((page.countedRedemptions - from) / (to - from)) * FULL_PERCENT)));
}

/** "4 more redemptions to Gold", or the Diamond line. */
export function nextTierLine(page: Pick<MyTier, "nextTier" | "redemptionsToNextTier">): string {
	if (page.nextTier === null || page.redemptionsToNextTier === null) {
		return "You're at the top tier. Keep redeeming to stay there.";
	}
	const count = page.redemptionsToNextTier;
	return `${String(count)} more ${count === 1 ? "redemption" : "redemptions"} to ${CUSTOMER_TIER_LABELS[page.nextTier]}`;
}

function day(epochMs: number): string {
	return formatEpochMs(epochMs, "date", PLATFORM_DISPLAY_REGION);
}

function changeLine(change: CustomerTierChange): string {
	return change.reason === "PROMOTION" ? `Moved up to ${CUSTOMER_TIER_LABELS[change.toTier]}` : `Moved down to ${CUSTOMER_TIER_LABELS[change.toTier]}`;
}

/**
 * The customer's tier page (ADR 085): where they stand and what's next, the tier hold, a pending warning, how many
 * redemptions each merchant still counts under the cap, what leaves the 12-month window soon, and their tier history.
 */
export function TierPageView({ page }: { readonly page: MyTier }): React.JSX.Element {
	const progress = tierProgressPercent(page);
	return (
		<div className="flex flex-col gap-6">
			<WebPageHeader
				title="My tier"
				description={`Your tier comes from the rewards you redeem in the last ${String(page.rules.windowDays)} days. Up to ${String(page.rules.perMerchantCap)} from each merchant count.`}
				actions={<TierBadge tier={page.tier} />}
			/>

			{page.demotionWarning === null ? null : (
				<Card className="border-warning/40 bg-warning/5" data-slot="tier-warning">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertTriangle aria-hidden className="size-4 text-warning" />
							Your {CUSTOMER_TIER_LABELS[page.tier]} ends on {day(page.demotionWarning.dueAt)}
						</CardTitle>
						<CardDescription>
							Redeem {String(page.demotionWarning.redemptionsToKeep)} more {page.demotionWarning.redemptionsToKeep === 1 ? "reward" : "rewards"} before then to keep it, or
							you&apos;ll move to {CUSTOMER_TIER_LABELS[page.demotionWarning.toTier]}.
						</CardDescription>
					</CardHeader>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>{nextTierLine(page)}</CardTitle>
					<CardDescription>
						{String(page.countedRedemptions)} counted {page.countedRedemptions === 1 ? "redemption" : "redemptions"} in your window.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Progress value={progress} aria-label="Progress to your next tier">
						<ProgressLabel>
							{page.nextTier === null ? CUSTOMER_TIER_LABELS[page.tier] : `${CUSTOMER_TIER_LABELS[page.tier]} → ${CUSTOMER_TIER_LABELS[page.nextTier]}`}
						</ProgressLabel>
						<ProgressValue />
					</Progress>
					{page.holdUntil === null ? null : (
						<p className="flex items-center gap-2 text-sm text-muted-foreground">
							<ShieldCheck aria-hidden className="size-4 text-success" />
							Your {CUSTOMER_TIER_LABELS[page.tier]} is yours until at least {day(page.holdUntil)}.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<MerchantCounts merchants={page.merchants} cap={page.rules.perMerchantCap} />
				<DropOffs dropOffs={page.upcomingDropOffs} />
			</div>

			<History history={page.history} />
		</div>
	);
}

function MerchantCounts({ merchants, cap }: { readonly merchants: readonly TierMerchantCount[]; readonly cap: number }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Where your redemptions count</CardTitle>
				<CardDescription>At most {String(cap)} from one merchant count toward your tier.</CardDescription>
			</CardHeader>
			<CardContent>
				{merchants.length === 0 ? (
					<p className="text-sm text-muted-foreground">Redeem a reward at any store to start counting.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Merchant</TableHead>
								<TableHead className="text-end">Counted</TableHead>
								<TableHead className="text-end">Still counts</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{merchants.map((merchant) => (
								<TableRow key={merchant.tenantId}>
									<TableCell>{merchant.tenantName}</TableCell>
									<TableCell className="text-end tabular-nums">{String(merchant.counted)}</TableCell>
									<TableCell className="text-end tabular-nums">{String(merchant.remainingUnderCap)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

function DropOffs({ dropOffs }: { readonly dropOffs: readonly TierDropOff[] }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Leaving your window soon</CardTitle>
				<CardDescription>Redemptions older than your window stop counting.</CardDescription>
			</CardHeader>
			<CardContent>
				{dropOffs.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nothing leaves your window soon.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{dropOffs.map((dropOff) => (
							<li key={dropOff.on} className="flex items-center justify-between py-2 text-sm">
								<span>{day(dropOff.on)}</span>
								<span className="text-muted-foreground tabular-nums">
									−{String(dropOff.count)} {dropOff.count === 1 ? "redemption" : "redemptions"}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function History({ history }: { readonly history: readonly CustomerTierChange[] }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Tier history</CardTitle>
			</CardHeader>
			<CardContent>
				{history.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>No changes yet</EmptyTitle>
							<EmptyDescription>Every move up or down will show here.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{history.map((change) => (
							<li key={change.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
								<span className="flex items-center gap-2">
									<StatusBadge tone={change.reason === "PROMOTION" ? "success" : "muted"}>{change.reason === "PROMOTION" ? "Up" : "Down"}</StatusBadge>
									{changeLine(change)}
								</span>
								<span className="text-muted-foreground">{day(change.occurredAt)}</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
