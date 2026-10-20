import { createHash } from "node:crypto";

const FINGERPRINT_SEPARATOR = ",";

/**
 * Fingerprint (sha256 hex) of the published policy versions a simulation ran
 * against — order-independent. Publishing compares the stored fingerprint
 * with the current one; any publish in between makes the simulation stale.
 */
export function policyBaselineFingerprint(versionIds: readonly string[]): string {
	return createHash("sha256")
		.update([...versionIds].sort().join(FINGERPRINT_SEPARATOR))
		.digest("hex");
}
