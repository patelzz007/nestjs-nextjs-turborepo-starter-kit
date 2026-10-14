"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { DataChangeLogDetail } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { DataChangeRecord } from "@/components/audit-logs/data-change-record";
import { RequestDataChanges } from "@/components/audit-logs/request-data-changes";
import { DataChangeDrawerSkeleton } from "@/components/loading/data-change-skeletons";
import { ROUTES } from "@/lib/routes";

/** The id a closed drawer queries with — never sent: the query is disabled while the drawer is closed. */
const NO_CHANGE_ID = "";

export interface DataChangeDrawerProps {
	/** The row change to show (`?change=` in the URL); `undefined` = closed. */
	readonly changeId: string | undefined;
	readonly onClose: () => void;
}

/**
 * The audit log's drawer for a background entry: the complete row change the
 * admin clicked, fetched on open (`GET /admin/data-changes/:id`, READ
 * AUDIT_LOG — the API records the opening as a sensitive read), every other
 * row the same job changed, and a link to the change's own page.
 * The selection lives in the URL, so a drawer can be shared.
 */
export function DataChangeDrawer({ changeId, onClose }: DataChangeDrawerProps): React.JSX.Element {
	const { api } = useAuth();
	const isOpen: boolean = changeId !== undefined;
	const detailQuery = api.dataChanges.detail.useQuery({ id: changeId ?? NO_CHANGE_ID }, { enabled: isOpen });
	const record: DataChangeLogDetail | undefined = detailQuery.data?.data;

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
			<SheetContent side="right" closeLabel="Close row change" className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl">
				<SheetHeader className="border-b pb-4">
					<SheetTitle>Row change</SheetTitle>
					<SheetDescription>The row before and after, and who changed it. Opening it is itself recorded.</SheetDescription>
					{changeId === undefined ? null : (
						<Link href={ROUTES.auditLogs.change(changeId)} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2 w-fit gap-1.5" })}>
							<ExternalLink className="size-3.5" aria-hidden />
							Open full page
						</Link>
					)}
				</SheetHeader>
				<div className="px-4 pb-6">
					{detailQuery.isLoading ? (
						<DataChangeDrawerSkeleton />
					) : record === undefined ? (
						<p className="py-10 text-sm text-destructive">Could not load this row change.</p>
					) : (
						<div className="space-y-4">
							<DataChangeRecord record={record} layout="drawer" />
							{record.correlationId === null ? null : <RequestDataChanges correlationId={record.correlationId} />}
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
