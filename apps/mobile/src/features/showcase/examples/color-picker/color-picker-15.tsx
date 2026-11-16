import { Button } from "@workspace/ui-native/components/button";
import { ColorPickerInput } from "@workspace/ui-native/components/color-picker";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";
import { View } from "react-native";
import { contrastRatio, parseHex, type Rgba } from "@workspace/ui-native/lib/color";

import { ignorePress } from "../example-support";

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
/** A button's label needs this much contrast on the brand colour. */
const MIN_CONTRAST = 4.5;

export function ColorPicker15Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#fde047");
	const error = contrastRatio(parseHex(color) ?? BLACK, WHITE) < MIN_CONTRAST ? "Too light for white text: pick a darker colour." : undefined;
	return (
		<View className="gap-3">
			<Field label="Brand colour" error={error}>
				<ColorPickerInput value={color} onChange={setColor} />
			</Field>
			<Button label="Save" disabled={error !== undefined} onPress={ignorePress} />
		</View>
	);
}
