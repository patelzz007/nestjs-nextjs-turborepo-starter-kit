import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "1", title: "Account" },
	{ key: "2", title: "Profile" },
	{ key: "3", title: "Company" },
	{ key: "4", title: "Team" },
	{ key: "5", title: "Billing" },
	{ key: "6", title: "Plan" },
	{ key: "7", title: "Review" },
	{ key: "8", title: "Done" },
];

export function StepperDont1Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} labelPosition="none" />
		</View>
	);
}
