/** What issuing a code for one user did. */
export type CodeMaintenanceOutcome = "first" | "successor" | "skipped";

/** The hourly code job's persistence (ADR 035, "Job"). */
export interface SignupReferralCodeMaintenancePort {
	/** Non-deleted users after `cursorId` (id order) whose latest code is missing or expired. */
	listUserIdsNeedingCode(now: number, limit: number, cursorId: string | null): Promise<readonly string[]>;
	/**
	 * In ONE transaction under the user's row lock: re-read the user and its latest code, and when a
	 * code is still due issue it and write the system audit row. Concurrent runs on several replicas
	 * serialize on the lock, so a user gets one code, not two.
	 */
	issueCodeIfDue(userId: string, now: number): Promise<CodeMaintenanceOutcome>;
}
