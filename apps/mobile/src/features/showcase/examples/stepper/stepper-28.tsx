import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "welcome", title: "Welcome" },
	{ key: "workspace", title: "Workspace" },
	{ key: "invite", title: "Invite" },
	{ key: "finish", title: "Finish" },
];

export function Stepper28Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<View className="gap-1">
				<Text className="text-caption font-sans-semibold text-muted-foreground uppercase">{`Onboarding · ${String(step)} / 4`}</Text>
				<Stepper steps={STEPS} value={step} onChange={setStep} variant="trail" />
			</View>
		</View>
	);
}
