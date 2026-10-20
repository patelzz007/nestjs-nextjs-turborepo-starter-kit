"use client";

import type { MfaRecoveryRecordStatus } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import * as React from "react";

const STATUS_LABELS: Record<MfaRecoveryRecordStatus, string> = {
	PENDING: "Pending review",
	APPROVED: "Approved",
	DENIED: "Denied",
	COMPLETED: "Completed",
};

/** A request waiting on an admin is the one to act on (`warning`); a denial is blocked; a finished request recedes. */
const STATUS_TONE: Record<MfaRecoveryRecordStatus, StatusTone> = {
	PENDING: "warning",
	APPROVED: "success",
	DENIED: "danger",
	COMPLETED: "muted",
};

export interface MfaRecoveryStatusBadgeProps {
	readonly status: MfaRecoveryRecordStatus;
}

export const MfaRecoveryStatusBadge = React.forwardRef<HTMLSpanElement, MfaRecoveryStatusBadgeProps>(function MfaRecoveryStatusBadge({ status }, ref): React.JSX.Element {
	return (
		<StatusBadge ref={ref} tone={STATUS_TONE[status]} className="text-xs">
			{STATUS_LABELS[status]}
		</StatusBadge>
	);
});
