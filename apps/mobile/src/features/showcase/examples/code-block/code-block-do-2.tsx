import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { snippet } from "./code-block-sample";

const SESSION = snippet("session");

export function CodeBlockDo2Example(): React.JSX.Element {
	return <CodeBlock code={SESSION.code} lines={SESSION.lines} showLineNumbers />;
}
