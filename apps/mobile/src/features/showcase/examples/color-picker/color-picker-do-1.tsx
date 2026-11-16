import { ColorPicker } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

const PRESETS: readonly string[] = ["#ef4444", "#22c55e", "#3b82f6"];

export function ColorPickerDo1Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return <ColorPicker value={color} onChange={setColor} presets={PRESETS} showInput={false} />;
}
