import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShoppingCartIcon from "lucide-react-native/icons/shopping-cart";
import TruckIcon from "lucide-react-native/icons/truck";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { stepStateFor, type StepState } from "@workspace/ui-native/components/stepper";
import { cn } from "@workspace/ui-native/lib/cn";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";

const STEPS: readonly { readonly key: string; readonly title: string; readonly icon: LucideIcon }[] = [
	{ key: "cart", title: "Cart", icon: ShoppingCartIcon },
	{ key: "shipping", title: "Shipping", icon: TruckIcon },
	{ key: "payment", title: "Payment", icon: CreditCardIcon },
	{ key: "done", title: "Done", icon: CircleCheckIcon },
];

function Row({
	index,
	step,
	active,
	onPick,
}: {
	readonly index: number;
	readonly step: (typeof STEPS)[number];
	readonly active: number;
	readonly onPick: (step: number) => void;
}): React.JSX.Element {
	const position = index + 1;
	const state: StepState = stepStateFor(position, active, false);
	const pick = React.useCallback((): void => {
		onPick(position);
	}, [onPick, position]);
	const accessibilityState = React.useMemo(() => ({ selected: state === "active" }), [state]);
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityLabel={`Step ${String(position)}: ${step.title}, ${state}`}
			accessibilityState={accessibilityState}
			onPress={pick}
			className={cn("flex-row items-center gap-3 border-b border-border p-3 active:bg-muted", state === "active" ? "bg-surface-selected" : undefined)}>
			<IconTile icon={step.icon} tone={state === "inactive" ? "neutral" : "brand"} size="sm" />
			<Text className="text-body font-sans-medium flex-1 text-foreground">{step.title}</Text>
			{state === "completed" ? (
				<Icon icon={CircleCheckIcon} size="sm" colorClassName="accent-success" />
			) : (
				<View className={cn("size-2.5 rounded-full", state === "active" ? "bg-primary" : "bg-border")} />
			)}
		</Pressable>
	);
}

export function Stepper24Example(): React.JSX.Element {
	const [active, setActive] = React.useState(2);
	return (
		<View className="gap-3">
			<View accessibilityRole="tablist" className="rounded-card overflow-hidden border border-border bg-card">
				{STEPS.map((step, index: number): React.JSX.Element => (
					<Row key={step.key} index={index} step={step} active={active} onPick={setActive} />
				))}
			</View>
			<Text className="text-body font-sans text-muted-foreground">{`Step ${String(active)} of ${String(STEPS.length)}`}</Text>
		</View>
	);
}
