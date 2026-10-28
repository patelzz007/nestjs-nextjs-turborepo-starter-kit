"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { DataChangeLogDetail, Envelope } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import type * as React from "react";

import { DataChangeRecord } from "@/contexts/audit/components/audit-logs/data-change-record";
import { RequestDataChanges } from "@/contexts/audit/components/audit-logs/request-data-changes";
import { DataChangeDetailPageSkeleton } from "@/components/loading/data-change-skeletons";
import { ROUTES } from "@/lib/routes";

export interface DataChangeDetailViewProps {
	readonly id: string;
	/** The server-prefetched `GET /admin/data-changes/:id` envelope, or `undefined` when the prefetch failed. */
	readonly initialRecord?: Envelope<DataChangeLogDetail> | undefined;
}

/**
 * `/audit-logs/changes/[id]` — one complete row change on its own page (the
 * audit log's drawer shows the same record; this page is the shareable,
 * printable form), with every other row the same request / job changed.
 */
export default function DataChangeDetailView({ id, initialRecord }: DataChangeDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	// GET /admin/data-changes/:id needs READ AUDIT_LOG, which the route guard enforces for this page.
	const detailQuery = api.dataChanges.detail.useQuery({ id }, initialDataOption(initialRecord));
	const record: DataChangeLogDetail | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && record === undefined) {
		return <DataChangeDetailPageSkeleton />;
	}

	if (detailQuery.isError || record === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.auditLogs.list} className={buttonVariants({ variant: "outline" })}>
					Back to audit log
				</Link>
				<p className="text-destructive">Could not load this row change.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-10xl space-y-6">
			<Link href={ROUTES.auditLogs.list} className={buttonVariants({ variant: "outline", size: "sm" })}>
				Back to audit log
			</Link>
			<DataChangeRecord record={record} layout="page" />
			{record.correlationId === null ? null : <RequestDataChanges correlationId={record.correlationId} />}
		</div>
	);
}
