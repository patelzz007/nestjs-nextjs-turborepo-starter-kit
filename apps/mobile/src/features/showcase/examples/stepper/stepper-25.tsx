import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "requested", title: "Requested" },
	{ key: "review", title: "In review", loading: true },
	{ key: "approved", title: "Approved" },
	{ key: "refunded", title: "Refunded" },
];

export function Stepper25Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="bar" />
			<Text className="text-body font-sans text-muted-foreground">Refund case #8812: we are checking your return. This takes 1–2 days.</Text>
		</View>
	);
}
