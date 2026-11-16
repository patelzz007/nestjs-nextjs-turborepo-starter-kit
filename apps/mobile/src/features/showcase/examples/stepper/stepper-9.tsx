import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Account" },
	{ key: "plan", title: "Plan" },
	{ key: "pay", title: "Pay" },
];

export function Stepper9Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} labelPosition="inline" />
		</View>
	);
}
