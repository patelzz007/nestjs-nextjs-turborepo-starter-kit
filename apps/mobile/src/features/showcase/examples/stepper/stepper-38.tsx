import HouseIcon from "lucide-react-native/icons/house";
import PackageIcon from "lucide-react-native/icons/package";
import ReceiptIcon from "lucide-react-native/icons/receipt";
import TruckIcon from "lucide-react-native/icons/truck";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "ordered", title: "Ordered", icon: ReceiptIcon },
	{ key: "packed", title: "Packed", icon: PackageIcon },
	{ key: "shipped", title: "Shipped", icon: TruckIcon },
	{ key: "delivered", title: "Delivered", icon: HouseIcon },
];

export function Stepper38Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} indicator="icon" completedTone="success" />
		</View>
	);
}
