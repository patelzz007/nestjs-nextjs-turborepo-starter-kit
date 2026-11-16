import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "terms", title: "Terms" },
	{ key: "pricing", title: "Pricing" },
	{ key: "sign", title: "Sign" },
];

export function Stepper35Example(): React.JSX.Element {
	const [step, setStep] = React.useState(1);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="chevron" />
		</View>
	);
}
