import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "build", title: "Build" },
	{ key: "test", title: "Test", loading: true },
	{ key: "deploy", title: "Deploy" },
];

export function Stepper14Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" completedTone="success" labelPosition="none" />
		</View>
	);
}
