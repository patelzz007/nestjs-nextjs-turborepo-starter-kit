import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShoppingCartIcon from "lucide-react-native/icons/shopping-cart";
import TruckIcon from "lucide-react-native/icons/truck";
import { Button } from "@workspace/ui-native/components/button";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "cart", title: "Cart", icon: ShoppingCartIcon },
	{ key: "shipping", title: "Shipping", icon: TruckIcon },
	{ key: "payment", title: "Payment", icon: CreditCardIcon },
	{ key: "done", title: "Done", icon: CircleCheckIcon },
];

export function Stepper19Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	const back = React.useCallback((): void => {
		setStep((current: number): number => Math.max(current - 1, 1));
	}, []);
	const next = React.useCallback((): void => {
		setStep((current: number): number => Math.min(current + 1, STEPS.length));
	}, []);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} variant="tiles" />
			<View className="rounded-card h-24 items-center justify-center border border-dashed border-input">
				<Text className="text-body font-sans text-muted-foreground">{STEPS.at(step - 1)?.title ?? ""}</Text>
			</View>
			<View className="flex-row justify-between">
				<Button label="Previous" variant="outline" size="sm" onPress={back} disabled={step === 1} />
				<Button label="Next" size="sm" onPress={next} disabled={step === STEPS.length} />
			</View>
		</View>
	);
}
