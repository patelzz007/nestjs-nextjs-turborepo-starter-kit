import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "draft", title: "1 Draft" },
	{ key: "review", title: "2 Review" },
	{ key: "sign", title: "3 Sign" },
];

export function Stepper32Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="chevron" />
		</View>
	);
}
