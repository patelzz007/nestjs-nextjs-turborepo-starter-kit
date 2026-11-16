import { ColorPicker } from "@workspace/ui-native/components/color-picker";
import * as React from "react";

const PRESETS: readonly string[] = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];

export function ColorPicker1Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	return <ColorPicker value={color} onChange={setColor} showAlpha presets={PRESETS} />;
}
