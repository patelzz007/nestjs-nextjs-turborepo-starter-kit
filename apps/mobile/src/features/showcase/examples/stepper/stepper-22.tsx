import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "card", title: "Card" },
	{ key: "address", title: "Address" },
	{ key: "confirm", title: "Confirm" },
];

export function Stepper22Example(): React.JSX.Element {
	const [step, setStep] = React.useState(1);
	return (
		<View className="rounded-card gap-3 border border-border p-3">
			<View className="h-24 items-center justify-center">
				<Text className="text-body font-sans text-muted-foreground">{STEPS.at(step - 1)?.title ?? ""}</Text>
			</View>
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="bar" completedTone="success" />
		</View>
	);
}
