import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";

export function ColorPickerDo2Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return (
		<Field label="Button colour" hint="White text reads at 4.5:1 or more.">
			<ColorPickerField label="Button colour" value={color} onChange={setColor} />
		</Field>
	);
}
