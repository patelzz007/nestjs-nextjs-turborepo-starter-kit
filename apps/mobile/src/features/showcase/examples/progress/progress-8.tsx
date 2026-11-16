import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { View } from "react-native";

/** The bars ease from where they start to this value shortly after they appear. */
const START_PROGRESS = 45;
const TARGET_PROGRESS = 75;
const FILL_DELAY_MS = 500;
/** Fills of the caller's: two status colours and three palette tones. */
const FILLS: readonly string[] = ["bg-success", "bg-warning", "bg-tone-violet", "bg-tone-blue", "bg-tone-teal"];

export function Progress8Example(): React.JSX.Element {
	const [progress, setProgress] = React.useState(START_PROGRESS);
	React.useEffect((): (() => void) => {
		const timer = setTimeout((): void => {
			setProgress(TARGET_PROGRESS);
		}, FILL_DELAY_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, []);
	return (
		<View className="gap-6">
			{FILLS.map((fill: string): React.JSX.Element => (
				<Progress key={fill} value={progress} indicatorClassName={fill} accessibilityLabel={`Progress in ${fill}`} />
			))}
		</View>
	);
}
