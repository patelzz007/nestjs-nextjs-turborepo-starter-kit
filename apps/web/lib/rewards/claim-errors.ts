import { ApiError } from "@workspace/client/lib/api/api-request";

/** Maps claim API failures to user-facing copy. */
export function formatClaimApiError(error: Error): string {
	if (error instanceof ApiError) {
		if (error.error === "REWARD_OUT_OF_STOCK") {
			return "This reward just sold out. Browse other offers.";
		}
		if (error.error === "REWARD_EXPIRED") {
			return "This reward has expired.";
		}
		if (error.error === "OTP_INVALID") {
			return "Invalid or expired OTP. Request a new code.";
		}
		if (error.error === "OTP_RATE_LIMITED") {
			return "Too many OTP attempts. Request a new code and try again.";
		}
		if (error.error === "LEGAL_ACCEPTANCE_REQUIRED") {
			return "Accept the Reward Hub terms before claiming.";
		}
	}
	return error.message;
}
