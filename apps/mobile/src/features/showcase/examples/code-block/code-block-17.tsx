import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { Switch } from "@workspace/ui-native/components/switch";
import { View } from "react-native";

const CSP =
	"default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; frame-ancestors 'none'";

// Soft wrap: a one-line policy that starts wrapped; the switch and a badge say which way it is.
export function CodeBlock17Example(): React.JSX.Element {
	const [wrap, setWrap] = React.useState(true);
	return (
		<View className="w-full gap-2">
			<CodeBlock code={CSP} caption="Content-Security-Policy" headerEnd={<Badge label={wrap ? "Wrapped" : "Scrolls"} variant="light" size="sm" />} wrap={wrap} size="sm" />
			<Switch label="Wrap long lines" checked={wrap} onChange={setWrap} />
		</View>
	);
}
