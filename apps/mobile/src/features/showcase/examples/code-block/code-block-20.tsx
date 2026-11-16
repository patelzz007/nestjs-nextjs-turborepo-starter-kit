import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const HERO = snippet("hero");

// A hero snippet behind three window dots, with a highlighted line and a marked word. (A phone block follows the app's theme; there is no forced-dark scope.)
export function CodeBlock20Example(): React.JSX.Element {
	const dots = (
		<View className="flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			<View className="size-2.5 rounded-full bg-tone-red" />
			<View className="size-2.5 rounded-full bg-tone-yellow" />
			<View className="size-2.5 rounded-full bg-tone-green" />
		</View>
	);
	return <CodeBlock code={HERO.code} lines={HERO.lines} header={dots} variant="card" lineMarks={[{ line: 2, kind: "highlight" }]} highlights={[{ text: "createApp" }]} />;
}
