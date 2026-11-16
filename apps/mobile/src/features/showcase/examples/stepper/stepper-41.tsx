import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "request", title: "Request sent" },
	{ key: "review", title: "Under review", loading: true },
	{ key: "decision", title: "Decision" },
];

export function Stepper41Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<View className="w-48">
				<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" indicator="ring" />
			</View>
		</View>
	);
}
