import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { snippet } from "./code-block-sample";

const GENERATED = snippet("generated");

// An excerpt of a generated file numbered from line 120, held to eight lines until opened.
export function CodeBlock10Example(): React.JSX.Element {
	return <CodeBlock code={GENERATED.code} lines={GENERATED.lines} caption="names.generated.ts" showLineNumbers startLine={120} maxLines={8} />;
}
