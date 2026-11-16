import * as React from "react";
import { StatCard } from "@workspace/ui/components/stat-card";
import { BanknoteIcon } from "lucide-react";

export function StatCardDo1Example(): React.JSX.Element {
	return <StatCard label="Revenue today" value="RM 4,210" hint="12 orders" icon={<BanknoteIcon />} tone="green" />;
}
