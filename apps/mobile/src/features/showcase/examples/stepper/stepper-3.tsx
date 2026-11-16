import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "upload", title: "Upload" },
	{ key: "scan", title: "Scan", loading: true },
	{ key: "publish", title: "Publish" },
];

export function Stepper3Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} indicator="ring" labelPosition="none" />
		</View>
	);
}
