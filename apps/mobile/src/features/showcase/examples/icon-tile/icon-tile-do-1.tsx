import { IconTile } from "@workspace/ui-native/components/icon-tile";
import WalletIcon from "lucide-react-native/icons/wallet";
import * as React from "react";
import { Text, View } from "react-native";

export function IconTileDo1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<IconTile icon={WalletIcon} tone="green" size="sm" />
			<Text className="text-label font-sans text-foreground">Payouts</Text>
		</View>
	);
}
