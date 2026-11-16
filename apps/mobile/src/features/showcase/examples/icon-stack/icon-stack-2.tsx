import { Icon, type IconSize } from "@workspace/ui-native/components/icon";
import { IconStack, type IconStackSize } from "@workspace/ui-native/components/icon-stack";
import LayersIcon from "lucide-react-native/icons/layers";
import * as React from "react";
import { Text, View } from "react-native";

interface SizeOption {
	readonly label: string;
	readonly size: IconStackSize;
	readonly glyph: IconSize;
}

const SIZES: readonly SizeOption[] = [
	{ label: "Small", size: "sm", glyph: "control" },
	{ label: "Default", size: "md", glyph: "sm" },
	{ label: "Large", size: "xl", glyph: "lg" },
];

export function IconStack2Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-end justify-center gap-8">
			{SIZES.map((item: SizeOption): React.JSX.Element => (
				<View key={item.label} className="items-center gap-2">
					<IconStack size={item.size}>
						<Icon icon={LayersIcon} size={item.glyph} colorClassName="accent-muted-foreground" />
					</IconStack>
					<Text className="text-label font-sans text-muted-foreground">{item.label}</Text>
				</View>
			))}
		</View>
	);
}
