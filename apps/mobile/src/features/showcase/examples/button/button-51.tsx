import PlusIcon from "lucide-react-native/icons/plus";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { View } from "react-native";

export function Button51Example(): React.JSX.Element {
	const [expanded, setExpanded] = React.useState<boolean>(false);
	const expand = React.useCallback((): void => {
		setExpanded(true);
	}, []);
	const collapse = React.useCallback((): void => {
		setExpanded(false);
	}, []);
	return (
		<View className="self-start">
			{expanded ? (
				<Button label="Create new" icon={PlusIcon} onPress={collapse} className="rounded-full" />
			) : (
				<IconButton icon={PlusIcon} label="Create new" variant="primary" onPress={expand} className="rounded-full" />
			)}
		</View>
	);
}
