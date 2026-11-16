import type { DocsSourceKind, DocsSyncRunStatus, DocsSyncTrigger } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { CircleCheck, CircleX, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type * as React from "react";

export const DOCS_SYNC_STATUS_LABELS: Readonly<Record<DocsSyncRunStatus, string>> = {
	SUCCEEDED: "Succeeded",
	PARTIAL: "Pages held back",
	BLOCKED: "Blocked",
	FAILED: "Failed",
};

export const DOCS_SYNC_TRIGGER_LABELS: Readonly<Record<DocsSyncTrigger, string>> = {
	WEBHOOK: "Page change",
	SCHEDULE: "Schedule",
	NIGHTLY: "Nightly rebuild",
	MANUAL: "By hand",
};

export const DOCS_SOURCE_LABELS: Readonly<Record<DocsSourceKind, string>> = {
	NOTION: "Notion",
};

/** A held-back page needs a writer; a blocked or failed run needs an operator. */
const STATUS_META: Readonly<Record<DocsSyncRunStatus, { readonly tone: StatusTone; readonly icon: LucideIcon }>> = {
	SUCCEEDED: { tone: "success", icon: CircleCheck },
	PARTIAL: { tone: "warning", icon: TriangleAlert },
	BLOCKED: { tone: "danger", icon: OctagonAlert },
	FAILED: { tone: "danger", icon: CircleX },
};

export function DocsSyncStatusBadge({ status }: { readonly status: DocsSyncRunStatus }): React.JSX.Element {
	const { tone, icon: Icon } = STATUS_META[status];
	return (
		<StatusBadge tone={tone} className="gap-1">
			<Icon className="size-3" aria-hidden />
			{DOCS_SYNC_STATUS_LABELS[status]}
		</StatusBadge>
	);
}
