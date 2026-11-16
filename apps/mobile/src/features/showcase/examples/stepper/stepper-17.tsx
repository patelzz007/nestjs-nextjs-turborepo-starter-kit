import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Account" },
	{ key: "profile", title: "Profile" },
	{ key: "plan", title: "Plan" },
	{ key: "review", title: "Review" },
];

export function Stepper17Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<View className="max-w-60">
				<Stepper steps={STEPS} value={step} onChange={setStep} variant="dots" labelPosition="none" />
			</View>
		</View>
	);
}
