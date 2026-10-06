"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { HttpAuditLogDetail } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { AuditLogRecord } from "@/components/audit-logs/audit-log-record";
import { ROUTES } from "@/lib/routes";

/** The id a closed drawer queries with — never sent: the query is disabled while the drawer is closed. */
const NO_RECORD_ID = "";

export interface AuditLogDrawerProps {
	/** The record to show (`?record=` in the URL); `undefined` = closed. */
	readonly recordId: string | undefined;
	readonly onClose: () => void;
}

/**
 * The audit log's details drawer: the complete record of the row the admin
 * clicked, fetched on open (`GET /admin/audit-logs/:id`, READ AUDIT_LOG — the
 * API records the opening as a sensitive read), with a link to the record's
 * own page. The selection lives in the URL, so a drawer can be shared.
 */
export function AuditLogDrawer({ recordId, onClose }: AuditLogDrawerProps): React.JSX.Element {
	const { api } = useAuth();
	const isOpen: boolean = recordId !== undefined;
	const detailQuery = api.auditLogs.detail.useQuery({ id: recordId ?? NO_RECORD_ID }, { enabled: isOpen });
	const record: HttpAuditLogDetail | undefined = detailQuery.data?.data;

	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<Sheet open={isOpen} onOpenChange={handleOpenChange}>
			<SheetContent side="right" closeLabel="Close audit record" className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl">
				<SheetHeader className="border-b pb-4">
					<SheetTitle>Audit record</SheetTitle>
					<SheetDescription>Everything recorded about this request. Opening it is itself recorded.</SheetDescription>
					{recordId === undefined ? null : (
						<Link href={ROUTES.auditLogs.detail(recordId)} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2 w-fit gap-1.5" })}>
							<ExternalLink className="size-3.5" aria-hidden />
							Open full page
						</Link>
					)}
				</SheetHeader>
				<div className="px-4 pb-6">
					{detailQuery.isLoading ? (
						<div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" aria-hidden />
							Loading audit record…
						</div>
					) : record === undefined ? (
						<p className="py-10 text-sm text-destructive">Could not load this audit record.</p>
					) : (
						<AuditLogRecord record={record} layout="drawer" />
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
