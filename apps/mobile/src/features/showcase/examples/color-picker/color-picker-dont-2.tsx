import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

export function ColorPickerDont2Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#fde047");
	return <ColorPickerField label="Button colour" value={color} onChange={setColor} />;
}
