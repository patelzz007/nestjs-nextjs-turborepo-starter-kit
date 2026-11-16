import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "import", title: "Import" },
	{ key: "map", title: "Map fields", loading: true },
	{ key: "review", title: "Review" },
];

export function Stepper29Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} indicator="ring" labelPosition="inline" />
		</View>
	);
}
