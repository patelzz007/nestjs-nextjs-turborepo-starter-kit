import type { JsonValue } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

// The building blocks both audit records are laid out with — the HTTP request
// record (`AuditLogRecord`) and the row-change record (`DataChangeRecord`) —
// so the two trails read alike and their skeletons line up with them.

/** Indentation of pretty-printed JSON. */
const JSON_INDENT_SPACES = 2;

/** What an absent value renders as. */
export const NOT_RECORDED = "—";

/** `page`: the full-width detail page; `drawer`: the narrower side panel of a table. */
export type AuditRecordLayout = "page" | "drawer";

/** The field grid of each section, per layout — shared with the records' loading skeletons. */
export const AUDIT_RECORD_GRID_BY_LAYOUT: Readonly<Record<AuditRecordLayout, string>> = {
	page: "sm:grid-cols-2 lg:grid-cols-3",
	drawer: "sm:grid-cols-2",
};

/** One labelled value; `mono` for ids, addresses and raw values. */
export function RecordField({ label, children, mono = false }: { readonly label: string; readonly children: React.ReactNode; readonly mono?: boolean }): React.JSX.Element {
	return (
		<div className="min-w-0 space-y-1">
			<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
			<dd className={cn("text-sm break-all", mono && "font-mono")}>{children}</dd>
		</div>
	);
}

/** A value, or the "not recorded" dash. */
export function orDash(value: string | number | null): string {
	return value === null ? NOT_RECORDED : String(value);
}

/** A bordered, titled group of {@link RecordField}s. */
export function RecordSection({
	title,
	description,
	layout,
	children,
}: {
	readonly title: string;
	readonly description: string;
	readonly layout: AuditRecordLayout;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section className="space-y-3 rounded-lg border bg-card p-4">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<dl className={cn("grid gap-4", AUDIT_RECORD_GRID_BY_LAYOUT[layout])}>{children}</dl>
		</section>
	);
}

/** A redacted JSON payload, pretty-printed; `null` = nothing was stored. */
export function RecordPayload({ title, value }: { readonly title: string; readonly value: JsonValue | null }): React.JSX.Element {
	return (
		<section className="min-w-0 space-y-2 rounded-lg border bg-card p-4">
			<h3 className="text-sm font-semibold">{title}</h3>
			{value === null ? (
				<p className="text-sm text-muted-foreground">Nothing recorded.</p>
			) : (
				<pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{JSON.stringify(value, null, JSON_INDENT_SPACES)}</pre>
			)}
		</section>
	);
}
