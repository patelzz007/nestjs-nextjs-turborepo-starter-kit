import { Field } from "@workspace/ui-native/components/field";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { View } from "react-native";

const PLANS: readonly SelectOption<string>[] = [
	{ value: "free", label: "Free" },
	{ value: "pro", label: "Pro" },
	{ value: "team", label: "Team" },
];
const CYCLES: readonly SelectOption<string>[] = [
	{ value: "monthly", label: "Monthly" },
	{ value: "yearly", label: "Yearly" },
];

export function Field3Example(): React.JSX.Element {
	const [plan, setPlan] = React.useState<string | null>("pro");
	const [cycle, setCycle] = React.useState<string | null>("yearly");
	return (
		<View className="gap-4">
			<Field label="Plan">
				<SelectField label="Plan" options={PLANS} value={plan} onChange={setPlan} />
			</Field>
			<Field label="Billing cycle">
				<SelectField label="Billing cycle" options={CYCLES} value={cycle} onChange={setCycle} />
			</Field>
		</View>
	);
}
