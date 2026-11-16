import StarIcon from "lucide-react-native/icons/star";
import { Toggle, type ToggleSize } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { Text, View } from "react-native";

const SIZES: readonly ToggleSize[] = ["sm", "md", "lg"];

function StarToggle({ size }: { readonly size: ToggleSize }): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return <Toggle label="Star" icon={StarIcon} hideLabel size={size} pressed={pressed} onChange={setPressed} />;
}

export function Toggle8Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			{SIZES.map((size: ToggleSize): React.JSX.Element => (
				<View key={size} className="flex-row items-center gap-3">
					<StarToggle size={size} />
					<Text className="text-caption font-sans text-muted-foreground">{size}</Text>
				</View>
			))}
		</View>
	);
}
