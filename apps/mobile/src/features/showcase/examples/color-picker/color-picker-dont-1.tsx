import { ColorPicker } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

export function ColorPickerDont1Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return <ColorPicker value={color} onChange={setColor} showInput={false} />;
}
