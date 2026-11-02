import { BROADCAST_STATUS_LABELS } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import type { BroadcastStatus } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import type * as React from "react";

const STATUS_TONES: Readonly<Record<BroadcastStatus, StatusTone>> = {
	DRAFT: "muted",
	PENDING_APPROVAL: "warning",
	SCHEDULED: "info",
	SENDING: "info",
	SENT: "success",
	PAUSED: "warning",
	CANCELLED: "neutral",
	FAILED: "danger",
};

/** A broadcast's state as a coloured badge. */
export function BroadcastStatusBadge({ status }: { readonly status: BroadcastStatus }): React.JSX.Element {
	return <StatusBadge tone={STATUS_TONES[status]}>{BROADCAST_STATUS_LABELS[status]}</StatusBadge>;
}
