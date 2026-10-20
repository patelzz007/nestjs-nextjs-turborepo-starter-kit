import { epochMs, type MfaRecoveryStatusResponse } from "@workspace/shared";

import type { MfaRecoveryRequestState, MfaRecoveryStatus } from "../../domain/aggregates/mfa-recovery-request.aggregate";

const STATUS_MESSAGES: Readonly<Record<MfaRecoveryStatus, string>> = {
	PENDING: "Your MFA recovery request is pending administrator review.",
	APPROVED: "Your MFA recovery request was approved. MFA will be disabled after the security delay.",
	DENIED: "Your MFA recovery request was denied.",
	COMPLETED: "MFA recovery is complete. Two-factor authentication has been disabled.",
};

/** The user-facing status of a recovery request (the unlock time only while approved). */
export function toMfaRecoveryStatusResponse(request: Pick<MfaRecoveryRequestState, "status" | "scheduledUnlockAt">): MfaRecoveryStatusResponse {
	const response: MfaRecoveryStatusResponse = { status: request.status, message: STATUS_MESSAGES[request.status] };
	if (request.scheduledUnlockAt !== null && request.status === "APPROVED") {
		return { ...response, scheduledUnlockAt: epochMs(request.scheduledUnlockAt) };
	}
	return response;
}
