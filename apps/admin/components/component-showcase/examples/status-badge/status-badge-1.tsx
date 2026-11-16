import type * as React from "react";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";

/** A feature maps its own statuses to a tone and a label once; the badge never sees the raw enum. */
type MemberStatus = "active" | "pending" | "suspended" | "invited" | "draft" | "archived";

const MEMBER_STATUS_DISPLAY: Readonly<Record<MemberStatus, { readonly tone: StatusTone; readonly label: string }>> = {
	active: { tone: "success", label: "Active" },
	pending: { tone: "warning", label: "Pending review" },
	suspended: { tone: "danger", label: "Suspended" },
	invited: { tone: "info", label: "Invited" },
	draft: { tone: "neutral", label: "Draft" },
	archived: { tone: "muted", label: "Archived" },
};

const STATUSES: readonly MemberStatus[] = ["active", "pending", "suspended", "invited", "draft", "archived"];

export function StatusBadge1Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{STATUSES.map((status: MemberStatus): React.JSX.Element => (
				<StatusBadge key={status} tone={MEMBER_STATUS_DISPLAY[status].tone}>
					{MEMBER_STATUS_DISPLAY[status].label}
				</StatusBadge>
			))}
		</div>
	);
}
