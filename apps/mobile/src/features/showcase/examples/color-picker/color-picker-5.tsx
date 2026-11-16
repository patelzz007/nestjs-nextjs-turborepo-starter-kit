import { ColorPickerField, ColorPickerSwatch } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";

interface LabelColor {
	readonly name: string;
	readonly hex: string;
}

/** An issue tracker's label colours. */
const LABELS: readonly LabelColor[] = [
	{ name: "Bug", hex: "#ef4444" },
	{ name: "Urgent", hex: "#f97316" },
	{ name: "Design", hex: "#eab308" },
	{ name: "Done", hex: "#22c55e" },
	{ name: "Docs", hex: "#14b8a6" },
	{ name: "Feature", hex: "#3b82f6" },
	{ name: "Research", hex: "#8b5cf6" },
	{ name: "Marketing", hex: "#ec4899" },
	{ name: "Chore", hex: "#64748b" },
];

export function ColorPicker5Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#22c55e");
	return (
		<View className="gap-3">
			<View className="flex-row flex-wrap gap-2">
				{LABELS.map(({ name, hex }: LabelColor): React.JSX.Element => (
					<ColorPickerSwatch key={name} color={hex} label={name} onPress={setColor} picked={hex === color} shape="round" />
				))}
			</View>
			<ColorPickerField label="Custom colour" value={color} onChange={setColor} />
		</View>
	);
}
