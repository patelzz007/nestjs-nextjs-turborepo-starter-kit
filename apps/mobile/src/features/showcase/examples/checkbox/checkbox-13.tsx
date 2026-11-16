import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

const PLANS: readonly string[] = ["Starter", "Growth", "Scale"];

function PlanTile({ plan }: { readonly plan: string }): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(plan === "Growth");
	return <Checkbox variant="card" label={plan} shape="round" controlPosition="end" checked={checked} onChange={setChecked} className="flex-1" />;
}

export function Checkbox13Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			{PLANS.map((plan: string): React.JSX.Element => (
				<PlanTile key={plan} plan={plan} />
			))}
		</View>
	);
}
