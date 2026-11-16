import CoffeeIcon from "lucide-react-native/icons/coffee";
import FlagIcon from "lucide-react-native/icons/flag";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import WarehouseIcon from "lucide-react-native/icons/warehouse";
import { Button } from "@workspace/ui-native/components/button";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { View } from "react-native";

const STEPS: readonly StepperStep[] = [
	{ key: "depot", title: "Depot", icon: WarehouseIcon, meta: "06:00" },
	{ key: "rest-1", title: "Rest stop", icon: CoffeeIcon, meta: "45 min" },
	{ key: "border", title: "Border", icon: FlagIcon, meta: "11:20" },
	{ key: "destination", title: "Destination", icon: MapPinIcon },
];

export function Stepper30Example(): React.JSX.Element {
	const [step, setStep] = React.useState(2);
	const back = React.useCallback((): void => {
		setStep((current: number): number => Math.max(current - 1, 1));
	}, []);
	const next = React.useCallback((): void => {
		setStep((current: number): number => Math.min(current + 1, STEPS.length));
	}, []);
	return (
		<View className="gap-4">
			<Stepper steps={STEPS} value={step} onChange={setStep} orientation="vertical" indicator="icon" completedTone="success" />
			<View className="flex-row justify-between">
				<Button label="Previous" variant="outline" size="sm" onPress={back} disabled={step === 1} />
				<Button label="Next" size="sm" onPress={next} disabled={step === STEPS.length} />
			</View>
		</View>
	);
}
