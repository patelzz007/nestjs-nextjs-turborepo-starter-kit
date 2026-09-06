"use client";

import type { MfaRecoveryRecordStatus } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import * as React from "react";

const STATUS_LABELS: Record<MfaRecoveryRecordStatus, string> = {
	PENDING: "Pending review",
	APPROVED: "Approved",
	DENIED: "Denied",
	COMPLETED: "Completed",
};

const STATUS_VARIANTS: Record<MfaRecoveryRecordStatus, "default" | "secondary" | "destructive" | "outline"> = {
	PENDING: "default",
	APPROVED: "secondary",
	DENIED: "destructive",
	COMPLETED: "outline",
};

export interface MfaRecoveryStatusBadgeProps {
	readonly status: MfaRecoveryRecordStatus;
}

export const MfaRecoveryStatusBadge = React.forwardRef<HTMLSpanElement, MfaRecoveryStatusBadgeProps>(function MfaRecoveryStatusBadge({ status }, ref): React.JSX.Element {
	return (
		<Badge ref={ref} variant={STATUS_VARIANTS[status]} className="text-xs">
			{STATUS_LABELS[status]}
		</Badge>
	);
});
