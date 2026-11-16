import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

export function Input28Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return <ColorPickerField label="Brand colour" value={color} onChange={setColor} />;
}
