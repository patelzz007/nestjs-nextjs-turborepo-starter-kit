import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack, type IconStackTone } from "@workspace/ui-native/components/icon-stack";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import * as React from "react";
import { Text, View } from "react-native";

interface ToneOption {
	readonly label: string;
	readonly tone: IconStackTone;
	/** The glyph's colour, set apart from the stack's. */
	readonly glyph: string;
}

const TONES: readonly ToneOption[] = [
	{ label: "Neutral", tone: "neutral", glyph: "accent-muted-foreground" },
	{ label: "Primary", tone: "primary", glyph: "accent-primary" },
	{ label: "Success", tone: "success", glyph: "accent-success" },
	{ label: "Warning", tone: "warning", glyph: "accent-warning" },
];

export function IconStack3Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-end justify-center gap-7">
			{TONES.map((item: ToneOption): React.JSX.Element => (
				<View key={item.label} className="items-center gap-2">
					<IconStack tone={item.tone}>
						<Icon icon={SparklesIcon} size="sm" colorClassName={item.glyph} />
					</IconStack>
					<Text className="text-label font-sans text-muted-foreground">{item.label}</Text>
				</View>
			))}
		</View>
	);
}
