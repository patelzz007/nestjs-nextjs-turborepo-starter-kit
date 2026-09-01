"use client";

import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantStatCard } from "@/components/merchant-ui/stat-card";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { stubPaginatedMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantRedemptionListItem } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { format } from "date-fns";
import { CalendarClock, Receipt, ScanLine } from "lucide-react";
import * as React from "react";

const REDEMPTIONS_PAGE = 1;
const REDEMPTIONS_LIMIT = 20;

export interface MerchantRedemptionsPageViewProps {
	readonly initialRows?: readonly MerchantRedemptionListItem[];
}

export function MerchantRedemptionsPageView({ initialRows }: MerchantRedemptionsPageViewProps): React.JSX.Element {
	const { api } = useAuth();

	const initialQueryData = React.useMemo(
		() =>
			initialRows !== undefined
				? {
						success: true as const,
						data: [...initialRows],
						meta: stubPaginatedMeta(initialRows.length, REDEMPTIONS_PAGE, REDEMPTIONS_LIMIT),
					}
				: undefined,
		[initialRows],
	);

	const redemptionsQuery = api.merchant.redemptions.useQuery(
		{ page: REDEMPTIONS_PAGE, limit: REDEMPTIONS_LIMIT },
		{
			initialData: initialQueryData,
		},
	);
	const rows: readonly MerchantRedemptionListItem[] = redemptionsQuery.data?.data ?? [];
	const isLoading = redemptionsQuery.isLoading && initialRows === undefined;

	const todayCount = rows.filter((row) => {
		const redeemed = new Date(row.redeemedAt);
		const now = new Date();
		return redeemed.getDate() === now.getDate() && redeemed.getMonth() === now.getMonth() && redeemed.getFullYear() === now.getFullYear();
	}).length;

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Redemptions" description="Recent POS redemptions for the selected store — newest first." />

			<div className="grid gap-4 sm:grid-cols-2">
				<MerchantStatCard label="Showing" value={String(rows.length)} hint="Latest page of activity" icon={<Receipt className="size-4" aria-hidden="true" />} />
				<MerchantStatCard label="Today" value={String(todayCount)} hint="Redeemed since midnight" icon={<CalendarClock className="size-4" aria-hidden="true" />} />
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading redemptions…</p>
			) : rows.length === 0 ? (
				<MerchantEmptyState
					title="No redemptions yet"
					description="When customers redeem at your POS terminals, activity will appear here with terminal and method details."
					icon={<ScanLine className="size-5" aria-hidden="true" />}
				/>
			) : (
				<div className="space-y-3">
					{rows.map((row) => (
						<MerchantSurfacePanel key={row.redemptionId} className="px-5 py-4">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{row.rewardTitle}</p>
									<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
										<span>{row.terminalId}</span>
										<span aria-hidden="true">·</span>
										<Badge variant="secondary">{row.redemptionMethod}</Badge>
									</div>
								</div>
								<time className="shrink-0 text-sm text-muted-foreground tabular-nums" dateTime={new Date(row.redeemedAt).toISOString()}>
									{format(new Date(row.redeemedAt), "d MMM yyyy · HH:mm")}
								</time>
							</div>
						</MerchantSurfacePanel>
					))}
				</div>
			)}
		</div>
	);
}
