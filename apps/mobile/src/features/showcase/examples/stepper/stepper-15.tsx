import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "account", title: "Create account" },
	{ key: "verify", title: "Verify email" },
	{ key: "team", title: "Invite team" },
];

export function Stepper15Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" />
			<Text className="text-body text-center font-sans text-muted-foreground">{`Content for step ${String(step)}`}</Text>
		</View>
	);
}
