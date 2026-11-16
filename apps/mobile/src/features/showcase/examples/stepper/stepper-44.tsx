import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Account", description: "Create your login" },
	{ key: "profile", title: "Profile", description: "Tell us about you" },
	{ key: "plan", title: "Plan", description: "Choose a plan" },
	{ key: "review", title: "Review", description: "Check and confirm" },
];

export function Stepper44Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" variant="segmented" />
		</View>
	);
}
