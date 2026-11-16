import { Gift, Store, Wallet } from "lucide-react";
import type * as React from "react";
import { StatCard } from "@workspace/ui/components/stat-card";

export function StatCard1Example(): React.JSX.Element {
	return (
		<div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<StatCard label="Active merchants" value="1,284" hint="+42 this week" icon={<Store />} tone="brand" />
			<StatCard label="Rewards claimed" value="18,930" hint="Across every store" icon={<Gift />} tone="green" />
			<StatCard label="Open disputes" value="7" hint="2 need a reply today" icon={<Wallet />} tone="red" />
		</div>
	);
}
