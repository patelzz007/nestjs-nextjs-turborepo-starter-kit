import { KpiStatCard, type KpiChange } from "@workspace/ui-native/components/kpi-stat-card";
import { Switch } from "@workspace/ui-native/components/switch";
import GiftIcon from "lucide-react-native/icons/gift";
import ShoppingBagIcon from "lucide-react-native/icons/shopping-bag";
import UsersIcon from "lucide-react-native/icons/users";
import * as React from "react";
import { View } from "react-native";

const REVENUE_UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.4%" };
const USERS_FLAT: KpiChange = { status: "change", direction: "flat", sentiment: "neutral", label: "0.0%" };
const NEW_METRIC: KpiChange = { status: "noPrevious", label: "New this period" };
const COMPARISON_LABEL = "vs the previous 30 days";

export function KpiStatCard1Example(): React.JSX.Element {
	const [loading, setLoading] = React.useState(false);
	return (
		<View className="gap-4">
			<Switch label="Loading" controlPosition="start" checked={loading} onChange={setLoading} />
			<KpiStatCard label="Revenue" value="RM 48,210" change={REVENUE_UP} comparisonLabel={COMPARISON_LABEL} icon={ShoppingBagIcon} iconTone="green" loading={loading} />
			<KpiStatCard label="Active users" value="9,312" change={USERS_FLAT} comparisonLabel={COMPARISON_LABEL} icon={UsersIcon} iconTone="blue" loading={loading} />
			<KpiStatCard label="Referrals" value="214" change={NEW_METRIC} icon={GiftIcon} iconTone="violet" loading={loading} />
		</View>
	);
}
