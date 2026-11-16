import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

export function Checkbox21Example(): React.JSX.Element {
	const [read, setRead] = React.useState<boolean>(true);
	const [write, setWrite] = React.useState<boolean>(false);
	const [remove, setRemove] = React.useState<boolean>(false);
	return (
		<View className="flex-row flex-wrap gap-x-5">
			<Checkbox label="Read" checked={read} onChange={setRead} />
			<Checkbox label="Write" checked={write} onChange={setWrite} />
			<Checkbox label="Delete" checked={remove} onChange={setRemove} />
		</View>
	);
}
