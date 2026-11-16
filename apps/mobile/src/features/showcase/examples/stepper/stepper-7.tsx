import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShoppingCartIcon from "lucide-react-native/icons/shopping-cart";
import TruckIcon from "lucide-react-native/icons/truck";
import { Badge } from "@workspace/ui-native/components/badge";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";

const STEPS: readonly StepperStep[] = [
	{ key: "cart", title: "Cart", description: "Step 1", icon: ShoppingCartIcon, badge: <Badge label="Completed" tone="success" size="sm" /> },
	{ key: "shipping", title: "Shipping", description: "Step 2", icon: TruckIcon, badge: <Badge label="In progress" tone="info" size="sm" /> },
	{ key: "payment", title: "Payment", description: "Step 3", icon: CreditCardIcon, badge: <Badge label="Pending" size="sm" /> },
];

export function Stepper7Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	return <Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" indicator="icon" />;
}
