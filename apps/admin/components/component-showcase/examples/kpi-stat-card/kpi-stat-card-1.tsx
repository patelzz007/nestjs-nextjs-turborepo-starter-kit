"use client";

import { Gift, ShoppingBag, Users } from "lucide-react";
import * as React from "react";
import { KpiStatCard, type KpiChange } from "@workspace/ui/components/kpi-stat-card";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";

const REVENUE_UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.4%" };
const USERS_FLAT: KpiChange = { status: "change", direction: "flat", sentiment: "neutral", label: "0.0%" };
const NEW_METRIC: KpiChange = { status: "noPrevious", label: "New this period" };
const COMPARISON_LABEL = "vs the previous 30 days";

export function KpiStatCard1Example(): React.JSX.Element {
	const [isLoading, setIsLoading] = React.useState<boolean>(false);

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex items-center gap-2">
				<Switch id="usage-kpi-loading" checked={isLoading} onCheckedChange={setIsLoading} />
				<Label htmlFor="usage-kpi-loading">Loading</Label>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<KpiStatCard label="Revenue" value="RM 48,210" change={REVENUE_UP} comparisonLabel={COMPARISON_LABEL} icon={ShoppingBag} iconTone="green" isLoading={isLoading} />
				<KpiStatCard label="Active users" value="9,312" change={USERS_FLAT} comparisonLabel={COMPARISON_LABEL} icon={Users} iconTone="blue" isLoading={isLoading} />
				<KpiStatCard label="Referrals" value="214" change={NEW_METRIC} icon={Gift} iconTone="violet" isLoading={isLoading} />
			</div>
		</div>
	);
}
