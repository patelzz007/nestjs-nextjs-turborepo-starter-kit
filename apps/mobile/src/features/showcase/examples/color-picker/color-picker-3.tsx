import { ColorPickerInput } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

export function ColorPicker3Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return <ColorPickerInput value={color} onChange={setColor} accessibilityLabel="Colour code" />;
}
