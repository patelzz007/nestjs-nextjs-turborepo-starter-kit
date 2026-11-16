import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "shanghai", title: "Shanghai", description: "Port of loading", meta: "3 Nov" },
	{ key: "singapore", title: "Singapore", description: "Transshipment", meta: "9 Nov", loading: true },
	{ key: "suez", title: "Suez Canal", description: "Transit", meta: "≈ 21 Nov" },
	{ key: "rotterdam", title: "Rotterdam", description: "Port of discharge", meta: "≈ 1 Dec" },
];

export function Stepper36Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" completedTone="success" />
		</View>
	);
}
