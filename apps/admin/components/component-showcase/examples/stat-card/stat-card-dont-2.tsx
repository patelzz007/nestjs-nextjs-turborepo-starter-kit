import * as React from "react";
import { StatCard } from "@workspace/ui/components/stat-card";
import { BanknoteIcon } from "lucide-react";

const FIGURES: readonly (readonly [string, string])[] = [
	["Revenue", "RM 48,210"],
	["Orders", "1,284"],
	["Refunds", "7"],
	["Visitors", "22,410"],
	["Sign-ups", "312"],
	["Churn", "1.2%"],
	["Tickets", "48"],
	["NPS", "41"],
];

export function StatCardDont2Example(): React.JSX.Element {
	return (
		<div className="grid w-full gap-3 sm:grid-cols-4">
			{FIGURES.map(([label, value]: readonly [string, string]): React.JSX.Element => (
				<StatCard key={label} label={label} value={value} hint="This month" icon={<BanknoteIcon />} tone="brand" />
			))}
		</div>
	);
}
