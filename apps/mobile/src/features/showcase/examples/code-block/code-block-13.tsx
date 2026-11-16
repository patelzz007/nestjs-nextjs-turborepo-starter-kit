import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { Input } from "@workspace/ui-native/components/input";
import { Switch } from "@workspace/ui-native/components/switch";
import { highlightRanges, type CodeHighlight } from "@workspace/ui-native/lib/code-block";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const CHECKOUT = snippet("checkout");

// Search in the file: each match is marked as you type, counted in the header, case-sensitive on request.
export function CodeBlock13Example(): React.JSX.Element {
	const [query, setQuery] = React.useState("sum");
	const [exact, setExact] = React.useState(false);
	const highlights = React.useMemo((): readonly CodeHighlight[] => [{ text: query, kind: "match", caseSensitive: exact }], [exact, query]);
	const matches = query === "" ? 0 : highlightRanges(CHECKOUT.code, highlights).length;
	const header = (
		<View className="flex-1 py-1.5 pr-2">
			<Input value={query} onChange={setQuery} placeholder="Search" accessibilityLabel="Search the file" size="sm" autoCapitalize="none" />
		</View>
	);
	return (
		<View className="w-full gap-2">
			<CodeBlock
				code={CHECKOUT.code}
				lines={CHECKOUT.lines}
				header={header}
				headerEnd={<Badge label={String(matches)} variant="light" size="sm" />}
				highlights={highlights}
				showLineNumbers
			/>
			<Switch label="Match case" checked={exact} onChange={setExact} />
		</View>
	);
}
