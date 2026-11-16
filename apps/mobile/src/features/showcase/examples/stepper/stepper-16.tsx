import { Button } from "@workspace/ui-native/components/button";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "warehouse", title: "Warehouse, Rotterdam", meta: "Left 07:10" },
	{ key: "hub", title: "Hub, Antwerp", meta: "Arrived 09:42", loading: true },
	{ key: "depot", title: "Depot, Brussels", meta: "ETA 12:30" },
	{ key: "door", title: "Your door", meta: "ETA 15:00" },
];

export function Stepper16Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	const back = React.useCallback((): void => {
		setStep((current: number): number => Math.max(current - 1, 1));
	}, []);
	const next = React.useCallback((): void => {
		setStep((current: number): number => Math.min(current + 1, STEPS.length));
	}, []);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" completedTone="success" />
			<View className="flex-row justify-between">
				<Button label="Previous" variant="outline" size="sm" onPress={back} disabled={step === 1} />
				<Button label="Next" size="sm" onPress={next} disabled={step === STEPS.length} />
			</View>
		</View>
	);
}
