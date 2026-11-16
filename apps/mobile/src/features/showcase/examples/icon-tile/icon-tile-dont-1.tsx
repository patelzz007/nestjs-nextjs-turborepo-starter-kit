import { IconTile } from "@workspace/ui-native/components/icon-tile";
import WalletIcon from "lucide-react-native/icons/wallet";
import * as React from "react";
import { Text, View } from "react-native";

// Red for money coming in: the tone says “blocked” where the label says “paid”.

export function IconTileDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<IconTile icon={WalletIcon} tone="red" size="sm" />
			<Text className="text-label font-sans text-foreground">Payouts</Text>
		</View>
	);
}
