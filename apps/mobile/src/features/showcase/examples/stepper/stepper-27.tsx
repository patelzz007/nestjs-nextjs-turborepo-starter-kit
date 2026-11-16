import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "a", title: "Central", meta: "08:02" },
	{ key: "b", title: "Harbour", meta: "08:15" },
	{ key: "c", title: "Museum", meta: "≈ 08:24" },
	{ key: "d", title: "Airport", meta: "≈ 08:51" },
];

export function Stepper27Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" indicator="ring" />
		</View>
	);
}
