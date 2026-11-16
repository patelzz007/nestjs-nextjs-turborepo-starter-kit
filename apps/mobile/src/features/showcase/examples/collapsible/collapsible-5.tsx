import SlidersHorizontalIcon from "lucide-react-native/icons/sliders-horizontal";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { View } from "react-native";

export function Collapsible5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [price, setPrice] = React.useState("120.00");
	const [tax, setTax] = React.useState("20");
	const [discount, setDiscount] = React.useState("0");
	const toggle = React.useCallback((): void => {
		setOpen((value: boolean): boolean => !value);
	}, []);
	return (
		<View className="gap-2">
			<View className="flex-row items-center gap-2">
				<InputGroup value={price} onChange={setPrice} leadingText="$" keyboardType="decimal-pad" accessibilityLabel="Price" className="flex-1" />
				<IconButton icon={SlidersHorizontalIcon} label={open ? "Hide price options" : "Show price options"} variant={open ? "primary" : "secondary"} onPress={toggle} />
			</View>
			{open ? (
				<View className="gap-2">
					<InputGroup value={tax} onChange={setTax} trailingText="%" keyboardType="decimal-pad" accessibilityLabel="Tax rate" />
					<InputGroup value={discount} onChange={setDiscount} trailingText="%" keyboardType="decimal-pad" accessibilityLabel="Discount" />
				</View>
			) : null}
		</View>
	);
}
