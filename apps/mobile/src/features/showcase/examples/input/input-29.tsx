import { Field } from "@workspace/ui-native/components/field";
import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { Text } from "react-native";

export function Input29Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(40);
	return (
		<Field label="Volume" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{String(value)}</Text>}>
			<Slider value={value} onChange={setValue} min={0} max={100} accessibilityLabel="Volume" />
		</Field>
	);
}
