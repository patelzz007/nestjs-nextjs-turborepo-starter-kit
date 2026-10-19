import type { DataChangeLogDetail, JsonValue } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import type * as React from "react";

import { buildDataChangeDiff, formatDataChangeValue, type DataChangeColumnStatus, type DataChangeDiffRow } from "@/contexts/audit/lib/data-change-diff";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { auditLogListHref } from "@/contexts/audit/url-state/audit-logs";

import { DataChangeActorKindBadge, DataChangeOperationBadge } from "./data-change-badges";
import { NOT_RECORDED, orDash, RecordField, RecordSection, type AuditRecordLayout } from "./record-layout";

/** Row tint per column status — what changed stands out, the rest of the row stays quiet. */
const STATUS_ROW_CLASS: Readonly<Record<DataChangeColumnStatus, string>> = {
	changed: "bg-yellow-500/10",
	added: "bg-green-500/10",
	removed: "bg-red-500/10",
	unchanged: "text-muted-foreground",
};

/** Screen-reader / tooltip wording per column status. */
const STATUS_LABEL: Readonly<Record<DataChangeColumnStatus, string>> = {
	changed: "Changed",
	added: "Set",
	removed: "Removed",
	unchanged: "Unchanged",
};

/** One cell of the diff: the stored (redacted) value, or the dash when the image has no such column. */
function DiffValue({ value }: { readonly value: JsonValue | undefined }): React.JSX.Element {
	return value === undefined ? (
		<span className="text-muted-foreground">{NOT_RECORDED}</span>
	) : (
		<span className="break-all whitespace-pre-wrap">{formatDataChangeValue(value)}</span>
	);
}

/** The row before and after, column by column; changed columns first. */
function DataChangeDiff({ record }: { readonly record: DataChangeLogDetail }): React.JSX.Element {
	const rows: DataChangeDiffRow[] = buildDataChangeDiff(record);
	if (rows.length === 0) {
		return <p className="text-sm text-muted-foreground">A TRUNCATE removes every row of the table at once — there is no single row to show.</p>;
	}
	return (
		<div className="overflow-x-auto rounded-md border">
			<table className="w-full text-left font-mono text-xs">
				<caption className="sr-only">Every column of the row before and after the change</caption>
				<thead className="bg-muted text-muted-foreground">
					<tr>
						<th scope="col" className="px-3 py-2 font-medium">
							Column
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Before
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							After
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row: DataChangeDiffRow) => (
						<tr key={row.column} className={cn("border-t align-top", STATUS_ROW_CLASS[row.status])}>
							<th scope="row" className="px-3 py-2 font-medium" title={STATUS_LABEL[row.status]}>
								{row.column}
								<span className="sr-only"> — {STATUS_LABEL[row.status]}</span>
							</th>
							<td className="px-3 py-2">
								<DiffValue value={row.before} />
							</td>
							<td className="px-3 py-2">
								<DiffValue value={row.after} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * One complete row change — presentational: the caller fetched it. Which row
 * of which table, how it changed (column by column, redacted), who it is
 * attributed to, and the database connection that made it. Ids link to the
 * audit log filtered to the request / job behind the change, to the actor,
 * the organization, and to the row's whole history.
 */
export function DataChangeRecord({ record, layout }: { readonly record: DataChangeLogDetail; readonly layout: AuditRecordLayout }): React.JSX.Element {
	return (
		<div className="space-y-4">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<DataChangeOperationBadge operation={record.operation} />
					<h2 className="font-mono text-base font-semibold break-all text-foreground">{record.tableName}</h2>
					<DataChangeActorKindBadge actorKind={record.actorKind} />
				</div>
				<p className="font-mono text-xs break-all text-muted-foreground">{record.rowId ?? "Whole table"}</p>
			</header>

			<section className="space-y-3 rounded-lg border bg-card p-4">
				<div>
					<h3 className="text-sm font-semibold">Row before and after</h3>
					<p className="text-xs text-muted-foreground">
						Redacted inside the database before it was stored: secrets read [REDACTED] (a changed secret is still marked as changed), personal data is masked and any value
						over 16 KiB is replaced by a truncation marker.
					</p>
				</div>
				<DataChangeDiff record={record} />
			</section>

			<RecordSection title="Who" description="Read from the database session the change ran in — set by the API from the verified principal." layout={layout}>
				<RecordField label="Attributed to">
					<DataChangeActorKindBadge actorKind={record.actorKind} />
				</RecordField>
				<RecordField label="Actor">
					{record.actor === null ? (
						NOT_RECORDED
					) : (
						<span className="space-y-0.5">
							<span className="block font-medium">{record.actor.fullName ?? "Unknown user"}</span>
							{record.actor.email === null ? null : <span className="block text-muted-foreground">{record.actor.email}</span>}
							<Link href={auditLogListHref({ actorUserId: record.actor.id })} className="block font-mono text-xs text-primary hover:underline">
								{record.actor.id}
							</Link>
						</span>
					)}
				</RecordField>
				<RecordField label="Organization">
					{record.organization === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ organizationId: record.organization.id })} className="text-primary hover:underline">
							{record.organization.name ?? record.organization.id}
						</Link>
					)}
				</RecordField>
				<RecordField label="API key" mono>
					{orDash(record.apiKeyId)}
				</RecordField>
				<RecordField label="System operation" mono>
					{orDash(record.systemOperation)}
				</RecordField>
				<RecordField label="Purpose">{orDash(record.actorPurpose)}</RecordField>
			</RecordSection>

			<RecordSection title="When" description="Database clock, shown in your time zone." layout={layout}>
				<RecordField label="Changed">{formatDateTimeWithSeconds(record.occurredAt)}</RecordField>
				<RecordField label="Recorded">{formatDateTimeWithSeconds(record.createdAt)}</RecordField>
			</RecordSection>

			<RecordSection
				title="Database connection"
				description="The role that ran the statement and the client that connected — this is how a manual SQL session shows up."
				layout={layout}>
				<RecordField label="Database role" mono>
					{record.databaseRole}
				</RecordField>
				<RecordField label="Login role" mono>
					{record.loginRole}
				</RecordField>
				<RecordField label="Application" mono>
					{orDash(record.applicationName)}
				</RecordField>
				<RecordField label="Client address" mono>
					{orDash(record.clientAddress)}
				</RecordField>
			</RecordSection>

			<RecordSection title="Tracing" description="The request (or job) behind the change in the audit log, and this row's history." layout={layout}>
				<RecordField label="Correlation id" mono>
					{record.correlationId === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ correlationId: record.correlationId })} className="text-primary hover:underline">
							{record.correlationId}
						</Link>
					)}
				</RecordField>
				<RecordField label="Row history">
					{record.rowId === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ tableName: record.tableName, rowId: record.rowId })} className="text-primary hover:underline">
							Every change to this row
						</Link>
					)}
				</RecordField>
				<RecordField label="Transaction" mono>
					{record.transactionId}
				</RecordField>
				<RecordField label="Write sequence" mono>
					{record.changeSequence}
				</RecordField>
				<RecordField label="Change record id" mono>
					{record.id}
				</RecordField>
			</RecordSection>
		</div>
	);
}
