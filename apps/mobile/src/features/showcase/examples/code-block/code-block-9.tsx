import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Text } from "react-native";

const OUTPUT = [
	"> next build",
	"   Creating an optimized production build ...",
	" ✓ Compiled successfully in 8.2s",
	" ✓ Linting and checking validity of types",
	" ✓ Generating static pages (24/24)",
	"",
	"Route (app)                Size     First Load JS",
	"┌ ○ /                      5.2 kB         102 kB",
	"└ ○ /dashboard             8.9 kB         118 kB",
].join("\n");

// Build output as plain text under a Terminal header: nothing to colour, so nothing is highlighted.
export function CodeBlock9Example(): React.JSX.Element {
	return <CodeBlock code={OUTPUT} header={<Text className="text-caption font-sans-medium text-muted-foreground">Terminal</Text>} size="sm" />;
}
