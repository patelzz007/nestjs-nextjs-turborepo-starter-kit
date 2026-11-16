import CreditCardIcon from "lucide-react-native/icons/credit-card";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

import { Icon } from "@workspace/ui-native/components/icon";

const STEPS: readonly StepperStep[] = [
	{ key: "card", title: "Card" },
	{ key: "address", title: "Address" },
	{ key: "confirm", title: "Confirm" },
];

export function Stepper23Example(): React.JSX.Element {
	const [step, setStep] = React.useState(1);
	return (
		<View className="rounded-card gap-3 border border-border p-3">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="bar" />
			<View className="aspect-video items-center justify-center rounded-xl bg-primary">
				<Icon icon={CreditCardIcon} size="lg" colorClassName="accent-primary-foreground" />
				<Text className="text-body font-mono text-primary-foreground">•••• •••• •••• 4242</Text>
			</View>
		</View>
	);
}
