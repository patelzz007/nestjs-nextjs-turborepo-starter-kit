import CheckIcon from "lucide-react-native/icons/check";
import PencilIcon from "lucide-react-native/icons/pencil";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Input } from "@workspace/ui-native/components/input";
import { Label } from "@workspace/ui-native/components/text";
import * as React from "react";
import { Text, View } from "react-native";

export function Label12Example(): React.JSX.Element {
	const [name, setName] = React.useState<string>("Atlas");
	const [editing, setEditing] = React.useState<boolean>(false);
	const toggle = React.useCallback((): void => {
		setEditing((current: boolean): boolean => !current);
	}, []);
	return (
		<View className="gap-1.5">
			<View className="flex-row items-center justify-between">
				<Label>Project name</Label>
				<IconButton icon={editing ? CheckIcon : PencilIcon} label={editing ? "Save the name" : "Edit the name"} variant="ghost" size="sm" onPress={toggle} />
			</View>
			{editing ? (
				<Input value={name} onChange={setName} accessibilityLabel="Project name" autoFocus />
			) : (
				<Text className="text-body-lg font-sans text-foreground">{name}</Text>
			)}
		</View>
	);
}
