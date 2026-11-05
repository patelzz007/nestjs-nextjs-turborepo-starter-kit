import type { ReceivedWebhookOutcome, ReceivedWebhookVerification } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { CircleCheck, CircleDashed, CircleX, Copy, Loader, ShieldAlert, ShieldCheck, ShieldOff, ShieldQuestion, TriangleAlert, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { RECEIVED_WEBHOOK_OUTCOME_LABELS, RECEIVED_WEBHOOK_VERIFICATION_LABELS } from "@/lib/data-table/enum-filter-options";

/** How each outcome reads: what was applied is green, what needs a look is red, the rest stays quiet. */
const OUTCOME_META: Readonly<Record<ReceivedWebhookOutcome, { readonly tone: StatusTone; readonly icon: LucideIcon }>> = {
	PROCESSING: { tone: "info", icon: Loader },
	RECORDED: { tone: "success", icon: CircleCheck },
	DUPLICATE: { tone: "muted", icon: Copy },
	IGNORED: { tone: "neutral", icon: CircleDashed },
	REJECTED: { tone: "warning", icon: CircleX },
	FAILED: { tone: "danger", icon: TriangleAlert },
};

/** A forged or unsigned request is a warning; a server without the provider's key is a failure of ours. */
const VERIFICATION_META: Readonly<Record<ReceivedWebhookVerification, { readonly tone: StatusTone; readonly icon: LucideIcon }>> = {
	VALID: { tone: "success", icon: ShieldCheck },
	INVALID: { tone: "warning", icon: ShieldAlert },
	MISSING: { tone: "warning", icon: ShieldQuestion },
	NOT_CONFIGURED: { tone: "danger", icon: ShieldOff },
};

/** What a received webhook came to, with its icon. */
export function ReceivedWebhookOutcomeBadge({ outcome }: { readonly outcome: ReceivedWebhookOutcome }): React.JSX.Element {
	const { tone, icon: Icon } = OUTCOME_META[outcome];
	return (
		<StatusBadge tone={tone} className="gap-1">
			<Icon className="size-3" aria-hidden />
			{RECEIVED_WEBHOOK_OUTCOME_LABELS[outcome]}
		</StatusBadge>
	);
}

/** What the signature check said, with its icon. */
export function ReceivedWebhookVerificationBadge({ verification }: { readonly verification: ReceivedWebhookVerification }): React.JSX.Element {
	const { tone, icon: Icon } = VERIFICATION_META[verification];
	return (
		<StatusBadge tone={tone} className="gap-1">
			<Icon className="size-3" aria-hidden />
			{RECEIVED_WEBHOOK_VERIFICATION_LABELS[verification]}
		</StatusBadge>
	);
}
