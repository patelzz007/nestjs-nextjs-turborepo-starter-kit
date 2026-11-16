import type * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Markdown } from "@/components/docs/markdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import type { ApiEntry, ApiEntryKind, ApiProp } from "@/components/component-showcase/showcase-api";
import { anchorOf } from "@/components/component-showcase/showcase-anchor";

const KIND_LABELS: Readonly<Record<ApiEntryKind, string>> = { component: "Component", hook: "Hook", function: "Helper" };
const CODE_CLASS = "rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.8rem] break-words text-foreground";

/** The anchor of one entry in the API reference (`api-code-block-copy-button`). */
export function apiAnchorOf(name: string): string {
	return `api-${anchorOf(name.replace(/([a-z0-9])([A-Z])/gu, "$1 $2"))}`;
}

function PropRow({ prop }: { readonly prop: ApiProp }): React.JSX.Element {
	return (
		<TableRow>
			<TableCell className="align-top">
				<code className={CODE_CLASS}>
					{prop.name}
					{prop.required ? null : "?"}
				</code>
			</TableCell>
			<TableCell className="w-56 max-w-56 align-top whitespace-normal">
				<code className={`${CODE_CLASS} text-muted-foreground`}>{prop.type}</code>
			</TableCell>
			<TableCell className="align-top">
				{prop.defaultValue === null ? <span className="text-muted-foreground">—</span> : <code className={CODE_CLASS}>{prop.defaultValue}</code>}
			</TableCell>
			<TableCell className="min-w-64 align-top text-sm whitespace-normal [&_p]:my-0 [&_p]:leading-6">
				{prop.description === "" ? null : <Markdown source={prop.description} />}
			</TableCell>
		</TableRow>
	);
}

function PropsTable({ entry }: { readonly entry: ApiEntry }): React.JSX.Element {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<Table aria-label={`${entry.name} props`}>
				<TableHeader className="bg-muted/50">
					<TableRow>
						<TableHead>Prop</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Default</TableHead>
						<TableHead>Description</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{entry.props.map((prop: ApiProp): React.JSX.Element => (
						<PropRow key={prop.name} prop={prop} />
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function ApiEntrySection({ entry }: { readonly entry: ApiEntry }): React.JSX.Element {
	const anchor = apiAnchorOf(entry.name);
	return (
		<section aria-labelledby={anchor} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h3 id={anchor} className="scroll-mt-6 font-mono text-lg font-semibold tracking-tight">
					{entry.name}
				</h3>
				<Badge variant="secondary" size="sm">
					{KIND_LABELS[entry.kind]}
				</Badge>
			</div>
			{entry.description === "" ? null : <Markdown source={entry.description} />}
			<p className="text-sm text-muted-foreground">
				Import from <code className={CODE_CLASS}>{entry.module}</code>
			</p>
			{entry.signature === null ? null : <code className={`${CODE_CLASS} block px-3 py-2 whitespace-pre-wrap`}>{entry.signature}</code>}
			{entry.kind === "component" && entry.props.length > 0 ? <PropsTable entry={entry} /> : null}
			{entry.kind === "component" && entry.props.length === 0 ? <p className="text-sm text-muted-foreground">No props of its own.</p> : null}
			{entry.inherits.length === 0 ? null : <p className="text-sm text-muted-foreground">Also accepts: {entry.inherits.join(", ")}.</p>}
		</section>
	);
}

export interface ShowcaseApiReferenceProps {
	readonly entries: readonly ApiEntry[];
}

/**
 * A component's API reference, generated from the kit's TypeScript
 * (`pnpm showcase:generate`): every component with the props it declares, and
 * every hook and helper with its signature.
 */
export function ShowcaseApiReference({ entries }: ShowcaseApiReferenceProps): React.JSX.Element {
	if (entries.length === 0) {
		return <p className="my-4 text-muted-foreground">This component exports nothing beyond what its examples show.</p>;
	}
	return (
		<div data-slot="showcase-api-reference" className="my-6 flex flex-col gap-10">
			{entries.map((entry: ApiEntry): React.JSX.Element => (
				<ApiEntrySection key={entry.name} entry={entry} />
			))}
		</div>
	);
}
