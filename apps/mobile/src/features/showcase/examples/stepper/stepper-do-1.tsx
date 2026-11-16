import { Button } from "@workspace/ui-native/components/button";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Account" },
	{ key: "profile", title: "Profile" },
	{ key: "plan", title: "Plan" },
	{ key: "review", title: "Review" },
];

export function StepperDo1Example(): React.JSX.Element {
	const [step, setStep] = React.useState(1);
	const back = React.useCallback((): void => {
		setStep((current: number): number => Math.max(current - 1, 1));
	}, []);
	const next = React.useCallback((): void => {
		setStep((current: number): number => Math.min(current + 1, STEPS.length));
	}, []);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} />
			<Text className="text-body font-sans text-muted-foreground">{`Step ${String(step)} of ${String(STEPS.length)}: ${STEPS.at(step - 1)?.title ?? ""}`}</Text>
			<View className="flex-row justify-between">
				<Button label="Previous" variant="outline" size="sm" onPress={back} disabled={step === 1} />
				<Button label="Next" size="sm" onPress={next} disabled={step === STEPS.length} />
			</View>
		</View>
	);
}
