import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import BoxesIcon from "lucide-react-native/icons/boxes";
import FileCodeIcon from "lucide-react-native/icons/file-code";
import PackageIcon from "lucide-react-native/icons/package";
import PaletteIcon from "lucide-react-native/icons/palette";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

interface RegistryItem {
	readonly name: string;
	readonly kind: string;
}

const ITEMS: readonly RegistryItem[] = [
	{ name: "@reui/c-data-grid-1", kind: "example" },
	{ name: "@reui/data-grid", kind: "component" },
	{ name: "button", kind: "ui" },
];

interface WrittenFile {
	readonly path: string;
	readonly created: boolean;
}

const FILES: readonly WrittenFile[] = [
	{ path: "components/reui/data-grid/data-grid.tsx", created: true },
	{ path: "components/ui/button.tsx", created: false },
	{ path: "components/examples/c-data-grid-1.tsx", created: true },
];

const CSS = `@theme inline {
  --color-success: var(--success);
  --color-info: var(--info);
  --color-warning: var(--warning);
}`;

/** The three theme lines the install adds. */
const CSS_MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "added" },
	{ line: 3, kind: "added" },
	{ line: 4, kind: "added" },
];

const CREATED = FILES.filter((file: WrittenFile): boolean => file.created);
const KEPT = FILES.filter((file: WrittenFile): boolean => !file.created);

// A file that already existed is kept: the installer never overwrites a file without asking.
export function Trace8Example(): React.JSX.Element {
	return (
		<Trace>
			<TraceLine icon={TerminalIcon} title="Ran shadcn add @reui/c-data-grid-1" description="9.4s" />
			<TraceStep icon={BoxesIcon} title={`Resolved ${String(ITEMS.length)} registry items`}>
				<Trace>
					{ITEMS.map((item: RegistryItem): React.JSX.Element => (
						<TraceLine key={item.name} title={item.name} description={item.kind} />
					))}
				</Trace>
			</TraceStep>
			<TraceLine icon={PackageIcon} title="Installed @tanstack/react-table" description="6.1s" />
			<TraceStep icon={FileCodeIcon} title={`Wrote ${String(CREATED.length)} files, kept ${String(KEPT.length)}`} defaultOpen>
				<Trace>
					{FILES.map((file: WrittenFile): React.JSX.Element => (
						<TraceLine key={file.path} title={file.created ? `Created ${file.path}` : `Kept ${file.path}, it already exists`} />
					))}
				</Trace>
			</TraceStep>
			<TraceStep icon={PaletteIcon} title="Updated app/globals.css" description="+3">
				<CodeBlock code={CSS} language="css" lineMarks={CSS_MARKS} caption="Changes to app/globals.css" />
			</TraceStep>
		</Trace>
	);
}
