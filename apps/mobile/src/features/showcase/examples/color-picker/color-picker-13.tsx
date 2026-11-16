import { Badge } from "@workspace/ui-native/components/badge";
import { ColorPickerField } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { Text, View } from "react-native";
import { contrastRatio, parseHex, type Rgba } from "@workspace/ui-native/lib/color";

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

interface Threshold {
	readonly label: string;
	readonly minimum: number;
}

/** WCAG's minimums: body text, large text, and controls. */
const THRESHOLDS: readonly Threshold[] = [
	{ label: "Body text", minimum: 4.5 },
	{ label: "Large text", minimum: 3 },
	{ label: "Controls", minimum: 3 },
];

export function ColorPicker13Example(): React.JSX.Element {
	const [text, setText] = React.useState<string>("#64748b");
	const [background, setBackground] = React.useState<string>("#ffffff");
	const ratio = contrastRatio(parseHex(text) ?? BLACK, parseHex(background) ?? BLACK);
	return (
		<View className="gap-3">
			<View className="flex-row gap-2">
				<ColorPickerField label="Text" value={text} onChange={setText} className="flex-1" />
				<ColorPickerField label="Background" value={background} onChange={setBackground} className="flex-1" />
			</View>
			<Text className="text-body font-sans text-foreground tabular-nums">{`Contrast ${ratio.toFixed(2)}:1`}</Text>
			<View className="flex-row flex-wrap gap-2">
				{THRESHOLDS.map(({ label, minimum }: Threshold): React.JSX.Element => (
					<Badge key={label} label={`${label} ${ratio >= minimum ? "passes" : "fails"}`} tone={ratio >= minimum ? "success" : "destructive"} size="sm" />
				))}
			</View>
		</View>
	);
}
