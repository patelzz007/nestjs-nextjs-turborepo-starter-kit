import * as React from "react";
import { Pressable, Text, View } from "react-native";

interface Mood {
	readonly emoji: string;
	readonly label: string;
}

const MOODS: readonly Mood[] = [
	{ emoji: "😞", label: "Terrible" },
	{ emoji: "🙁", label: "Bad" },
	{ emoji: "😐", label: "Okay" },
	{ emoji: "🙂", label: "Good" },
	{ emoji: "😍", label: "Amazing" },
];

interface MoodButtonProps extends Mood {
	readonly picked: boolean;
	readonly onPick: (label: string) => void;
}

function MoodButton({ emoji, label, picked, onPick }: MoodButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(label);
	}, [label, onPick]);
	const state = React.useMemo(() => ({ selected: picked }), [picked]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={state}
			onPress={press}
			className={picked ? "bg-surface-selected size-12 items-center justify-center rounded-full" : "size-12 items-center justify-center rounded-full"}>
			<Text className="text-h2">{emoji}</Text>
		</Pressable>
	);
}

export function Rating8Example(): React.JSX.Element {
	const [mood, setMood] = React.useState<string | null>(null);
	return (
		<View className="gap-2">
			<View className="flex-row gap-2">
				{MOODS.map(({ emoji, label }: Mood): React.JSX.Element => (
					<MoodButton key={label} emoji={emoji} label={label} picked={mood === label} onPick={setMood} />
				))}
			</View>
			<Text className="text-body font-sans text-muted-foreground">{mood ?? "How was it?"}</Text>
		</View>
	);
}
