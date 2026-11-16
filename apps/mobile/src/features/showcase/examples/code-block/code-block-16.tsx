import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const BEFORE = snippet("before");
const AFTER = snippet("after");

// Before and after a refactor: a loop folded into a reduce, as two blocks with their headers.
export function CodeBlock16Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<CodeBlock code={BEFORE.code} lines={BEFORE.lines} header={<Badge label="Before" tone="destructive" variant="light" size="sm" />} variant="card" />
			<CodeBlock code={AFTER.code} lines={AFTER.lines} header={<Badge label="After" tone="success" variant="light" size="sm" />} variant="card" />
		</View>
	);
}
