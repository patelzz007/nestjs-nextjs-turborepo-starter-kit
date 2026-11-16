import * as React from "react";
import { StatCard } from "@workspace/ui/components/stat-card";
import { BanknoteIcon } from "lucide-react";

export function StatCardDo2Example(): React.JSX.Element {
	return (
		<div className="grid w-full gap-3 sm:grid-cols-3">
			<StatCard label="Revenue" value="RM 48,210" hint="This month" icon={<BanknoteIcon />} tone="green" />
			<StatCard label="Orders" value="1,284" hint="This month" icon={<BanknoteIcon />} tone="brand" />
			<StatCard label="Refunds" value="7" hint="This month" icon={<BanknoteIcon />} tone="red" />
		</div>
	);
}
