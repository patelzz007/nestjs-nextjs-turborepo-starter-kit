import { BoxesIcon, FileCodeIcon, PackageIcon, PaletteIcon, TerminalIcon } from "lucide-react";
import type * as React from "react";

import { CodeBlock, type CodeBlockDiffSpec } from "@workspace/ui/components/code-block";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

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

const css = `@theme inline {
  --color-success: var(--success);
  --color-info: var(--info);
  --color-warning: var(--warning);
}`;

/** The three theme lines the install adds. */
const CSS_DIFF: CodeBlockDiffSpec = { added: [2, 3, 4] };

// A file that already existed is kept, because shadcn add never overwrites a
// file without asking.
export function Trace8Example(): React.JSX.Element {
	const created = FILES.filter((file: WrittenFile): boolean => file.created);
	const skipped = FILES.filter((file: WrittenFile): boolean => !file.created);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<TerminalIcon />
					</TraceIcon>
					<TraceTitle>Ran shadcn add @reui/c-data-grid-1</TraceTitle>
					<TraceDescription>9.4s</TraceDescription>
				</TraceLine>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<BoxesIcon />
							</TraceIcon>
							<TraceTitle>Resolved {ITEMS.length} registry items</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{ITEMS.map((item: RegistryItem): React.JSX.Element => (
								<TraceLine key={item.name}>
									<TraceTitle>
										<code>{item.name}</code>
									</TraceTitle>
									<TraceDescription>{item.kind}</TraceDescription>
								</TraceLine>
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceLine>
					<TraceIcon>
						<PackageIcon />
					</TraceIcon>
					<TraceTitle>Installed @tanstack/react-table</TraceTitle>
					<TraceDescription>6.1s</TraceDescription>
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<FileCodeIcon />
							</TraceIcon>
							<TraceTitle>
								Wrote {created.length} files, kept {skipped.length}
							</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{FILES.map((file: WrittenFile): React.JSX.Element =>
								file.created ? (
									<TraceLine key={file.path}>
										<TraceTitle>Created {file.path}</TraceTitle>
									</TraceLine>
								) : (
									<TraceLine key={file.path}>
										<TraceTitle>Kept {file.path}, it already exists</TraceTitle>
									</TraceLine>
								),
							)}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<PaletteIcon />
							</TraceIcon>
							<TraceTitle>Updated app/globals.css</TraceTitle>
							<TraceDescription>+3</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock code={css} language="css" diff={CSS_DIFF} label="Changes to app/globals.css" />
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		</div>
	);
}
