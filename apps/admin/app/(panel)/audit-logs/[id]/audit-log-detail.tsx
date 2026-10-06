"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, HttpAuditLogDetail } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { AuditLogRecord } from "@/components/audit-logs/audit-log-record";
import { ROUTES } from "@/lib/routes";

export interface AuditLogDetailViewProps {
	readonly id: string;
	/** The server-prefetched `GET /admin/audit-logs/:id` envelope, or `undefined` when the prefetch failed. */
	readonly initialRecord?: Envelope<HttpAuditLogDetail> | undefined;
}

/**
 * `/audit-logs/[id]` — one complete audit record on its own page (the table's
 * drawer shows the same record; this page is the shareable, printable form).
 */
export default function AuditLogDetailView({ id, initialRecord }: AuditLogDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	// GET /admin/audit-logs/:id needs READ AUDIT_LOG, which the route guard enforces for this page.
	const detailQuery = api.auditLogs.detail.useQuery({ id }, initialDataOption(initialRecord));
	const record: HttpAuditLogDetail | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && record === undefined) {
		return <p className="text-sm text-muted-foreground">Loading audit record…</p>;
	}

	if (detailQuery.isError || record === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.auditLogs.list} className={buttonVariants({ variant: "outline" })}>
					<ArrowLeft className="mr-2 size-4" />
					Back to audit log
				</Link>
				<p className="text-destructive">Could not load this audit record.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<Link href={ROUTES.auditLogs.list} className={buttonVariants({ variant: "outline", size: "sm" })}>
				<ArrowLeft className="mr-2 size-4" />
				Back to audit log
			</Link>
			<AuditLogRecord record={record} layout="page" />
		</div>
	);
}
