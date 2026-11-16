import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShoppingCartIcon from "lucide-react-native/icons/shopping-cart";
import TruckIcon from "lucide-react-native/icons/truck";
import { stepStateFor } from "@workspace/ui-native/components/stepper";
import { cn } from "@workspace/ui-native/lib/cn";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";

const STEPS: readonly { readonly key: string; readonly title: string; readonly detail: string; readonly icon: LucideIcon }[] = [
	{ key: "cart", title: "Cart", detail: "3 items, $129.00", icon: ShoppingCartIcon },
	{ key: "shipping", title: "Shipping", detail: "Standard, 3–5 days", icon: TruckIcon },
	{ key: "payment", title: "Payment", detail: "Visa •••• 4242", icon: CreditCardIcon },
	{ key: "done", title: "Done", detail: "Order confirmed", icon: CircleCheckIcon },
];

function Card({ index, active, onPick }: { readonly index: number; readonly active: number; readonly onPick: (step: number) => void }): React.JSX.Element | null {
	const step = STEPS.at(index);
	const position = index + 1;
	const state = stepStateFor(position, active, false);
	const pick = React.useCallback((): void => {
		onPick(position);
	}, [onPick, position]);
	const accessibilityState = React.useMemo(() => ({ selected: state === "active" }), [state]);
	if (step === undefined) {
		return null;
	}
	return (
		<View className="p-1">
			<Pressable
				accessibilityRole="tab"
				accessibilityLabel={`${step.title}, ${state}`}
				accessibilityState={accessibilityState}
				onPress={pick}
				className={cn("rounded-card gap-1 border p-3 active:opacity-80", state === "active" ? "border-primary bg-primary/10" : "border-border bg-card")}>
				<Icon icon={step.icon} size="sm" colorClassName={state === "inactive" ? "accent-muted-foreground" : "accent-primary"} />
				<Text className="text-body font-sans-semibold text-foreground">{step.title}</Text>
			</Pressable>
		</View>
	);
}

export function Stepper39Example(): React.JSX.Element {
	const [active, setActive] = React.useState(2);
	return (
		<View className="gap-3">
			<View accessibilityRole="tablist" className="w-60">
				{STEPS.map((step, index: number): React.JSX.Element => (
					<Card key={step.key} index={index} active={active} onPick={setActive} />
				))}
			</View>
			<Text className="text-body font-sans text-muted-foreground">{STEPS.at(active - 1)?.detail ?? ""}</Text>
		</View>
	);
}
