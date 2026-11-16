import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";

import { snippet, type Snippet } from "./code-block-sample";

type Tab = "tsx" | "python" | "sql" | "bash";
const TABS: readonly { readonly value: Tab; readonly label: string }[] = [
	{ value: "tsx", label: "greeting.tsx" },
	{ value: "python", label: "greet.py" },
	{ value: "sql", label: "top.sql" },
	{ value: "bash", label: "build.sh" },
];
const FILES: Readonly<Record<Tab, Snippet>> = { tsx: snippet("tabs-tsx"), python: snippet("tabs-python"), sql: snippet("tabs-sql"), bash: snippet("tabs-bash") };

// File tabs in a dense frame: snippets in TSX, Python, SQL and Bash behind tabs.
export function CodeBlock14Example(): React.JSX.Element {
	const [tab, setTab] = React.useState<Tab>("tsx");
	const shown = FILES[tab];
	return (
		<Frame dense className="w-full">
			<FramePanel className="p-0">
				<CodeBlock
					code={shown.code}
					lines={shown.lines}
					header={<SegmentedControl label="File" options={TABS} value={tab} onChange={setTab} size="sm" />}
					variant="card"
					size="sm"
				/>
			</FramePanel>
		</Frame>
	);
}
