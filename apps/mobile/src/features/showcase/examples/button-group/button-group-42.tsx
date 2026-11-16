import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";
import { Text, View } from "react-native";

interface OrderType {
	readonly type: string;
	readonly hint: string;
}

const ORDER_TYPES: readonly OrderType[] = [
	{ type: "Market", hint: "Buy or sell now, at the best price available." },
	{ type: "Limit", hint: "Only at your price or better." },
	{ type: "Stop", hint: "A market order once the price reaches the stop." },
	{ type: "Stop limit", hint: "A limit order once the price reaches the stop." },
];

interface OrderTypeButtonProps {
	readonly type: string;
	readonly hint: string;
	readonly picked: boolean;
	readonly onPick: (type: string) => void;
}

function OrderTypeButton({ type, hint, picked, onPick }: OrderTypeButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(type);
	}, [onPick, type]);
	return <Button label={type} accessibilityHint={hint} variant={picked ? "secondary" : "outline"} size="sm" onPress={press} className="flex-1 px-0" />;
}

export function ButtonGroup42Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string>("Market");
	return (
		<View className="gap-2">
			<ButtonGroup accessibilityLabel="Order type">
				{ORDER_TYPES.map(({ type, hint }: OrderType): React.JSX.Element => (
					<OrderTypeButton key={type} type={type} hint={hint} picked={picked === type} onPick={setPicked} />
				))}
			</ButtonGroup>
			<Text className="text-caption font-sans text-muted-foreground">{ORDER_TYPES.find((order: OrderType): boolean => order.type === picked)?.hint}</Text>
		</View>
	);
}
