import type { PaymentStatus } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import type * as React from "react";

import { PAYMENT_STATUS_LABELS } from "@/contexts/payments/lib/payments";

const STATUS_TONES: Readonly<Record<PaymentStatus, StatusTone>> = {
	PENDING: "warning",
	PAID: "success",
	FAILED: "danger",
	CANCELLED: "neutral",
	REFUNDED: "info",
};

/** A payment's state as a coloured badge. */
export function PaymentStatusBadge({ status }: { readonly status: PaymentStatus }): React.JSX.Element {
	return <StatusBadge tone={STATUS_TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</StatusBadge>;
}
