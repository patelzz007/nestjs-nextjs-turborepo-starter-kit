import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "placed", title: "Placed", meta: "09:12" },
	{ key: "packed", title: "Packed", meta: "11:40" },
	{ key: "shipped", title: "Shipped" },
	{ key: "delivered", title: "Delivered" },
];

export function Stepper26Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="bar" />
		</View>
	);
}
