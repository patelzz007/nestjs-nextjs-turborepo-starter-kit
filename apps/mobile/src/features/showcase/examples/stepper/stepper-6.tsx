import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "details", title: "User details" },
	{ key: "company", title: "Company" },
	{ key: "preview", title: "Preview form" },
];

export function Stepper6Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} labelPosition="inline" fillConnectors={false} />
		</View>
	);
}
