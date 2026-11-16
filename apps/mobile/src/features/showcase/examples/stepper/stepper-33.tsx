import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShoppingCartIcon from "lucide-react-native/icons/shopping-cart";
import TruckIcon from "lucide-react-native/icons/truck";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "cart", title: "Cart", icon: ShoppingCartIcon },
	{ key: "shipping", title: "Shipping", icon: TruckIcon },
	{ key: "payment", title: "Payment", icon: CreditCardIcon },
	{ key: "done", title: "Done", icon: CircleCheckIcon },
];

export function Stepper33Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return (
		<View className="gap-4">
			<View className="rounded-full bg-invert p-1">
				<Stepper steps={STEPS} value={step} onChange={setStep} variant="chevron" labelPosition="none" />
			</View>
		</View>
	);
}
