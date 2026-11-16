import { ColorPickerInput, ColorPickerSwatch, hueOf } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";
import { hsvToRgb, toHex } from "@workspace/ui-native/lib/color";

/** The scale's brightness steps, light to dark. */
const STEPS: readonly number[] = [1, 0.9, 0.75, 0.6, 0.45, 0.3];
const PERCENT = 100;

export function ColorPicker14Example(): React.JSX.Element {
	const [base, setBase] = React.useState<string>("#8b5cf6");
	return (
		<View className="gap-3">
			<ColorPickerInput value={base} onChange={setBase} accessibilityLabel="Base colour" />
			<View className="flex-row flex-wrap gap-2">
				{STEPS.map((step: number): React.JSX.Element => (
					<ColorPickerSwatch key={step} color={toHex(hsvToRgb({ h: hueOf(base), s: 0.85, v: step, a: 1 }))} label={`Brand ${String(Math.round(step * PERCENT))}`} size="lg" />
				))}
			</View>
		</View>
	);
}
