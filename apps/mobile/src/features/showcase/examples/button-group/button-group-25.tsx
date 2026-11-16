import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";
import { Text, View } from "react-native";

/** The scale's scores, 1 to 10. */
const SCORES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ScoreButtonProps {
	readonly score: number;
	readonly picked: boolean;
	readonly onPick: (score: number) => void;
}

function ScoreButton({ score, picked, onPick }: ScoreButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(score);
	}, [onPick, score]);
	return <Button label={String(score)} variant={picked ? "primary" : "outline"} size="sm" onPress={press} className="flex-1 px-0" />;
}

export function ButtonGroup25Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<number | null>(null);
	return (
		<View className="gap-2">
			<ButtonGroup accessibilityLabel="How likely are you to recommend us?">
				{SCORES.map((score: number): React.JSX.Element => (
					<ScoreButton key={score} score={score} picked={picked === score} onPick={setPicked} />
				))}
			</ButtonGroup>
			<View className="flex-row justify-between">
				<Text className="text-caption font-sans text-muted-foreground">Not likely</Text>
				<Text className="text-caption font-sans text-muted-foreground">Very likely</Text>
			</View>
		</View>
	);
}
