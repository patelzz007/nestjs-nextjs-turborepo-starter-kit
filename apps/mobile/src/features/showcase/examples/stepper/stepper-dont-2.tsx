import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Account" },
	{ key: "profile", title: "Profile" },
	{ key: "plan", title: "Plan" },
	{ key: "review", title: "Review" },
];

export function StepperDont2Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} labelPosition="none" fillConnectors={false} />
		</View>
	);
}
