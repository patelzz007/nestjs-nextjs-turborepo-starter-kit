import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { snippet, useCopy } from "./code-block-sample";

const SESSION = snippet("session");

export function CodeBlockDo1Example(): React.JSX.Element {
	const { copied, copy } = useCopy(SESSION.code);
	return <CodeBlock code={SESSION.code} lines={SESSION.lines} language="TypeScript" onCopy={copy} copied={copied} />;
}
