import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "scope", title: "Scope" },
	{ key: "design", title: "Design" },
	{ key: "build", title: "Build" },
	{ key: "launch", title: "Launch" },
];

export function Stepper34Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-4">
			<View className="gap-2">
				<Text className="text-caption font-sans-medium self-start rounded-full bg-muted px-2 py-0.5 text-foreground">Plan · 2 of 4 done</Text>
				<Stepper steps={STEPS} value={step} onChange={setStep} variant="chevron" />
			</View>
		</View>
	);
}
