import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { secureEquals } from "../../../../platform/infrastructure/utils/secure-equals";
import type { ProcessingCallbackAuthenticator } from "../../application/ports/file-processing.port";

/** Checks the worker's secret against `STORAGE_PROCESSING_CALLBACK_SECRET` (null when not configured). */
export class SharedSecretCallbackAuthenticator implements ProcessingCallbackAuthenticator {
	public constructor(private readonly expectedSecret: string | null) {}

	public assertAuthentic(presentedSecret: string | null): void {
		// Fail closed in EVERY environment: without the secret nobody can prove they are the processing worker.
		if (this.expectedSecret === null) {
			throw new AuthenticationError({ code: "CALLBACK_UNAUTHORIZED", message: "Processing callback secret is not configured" });
		}
		// Constant-time comparison: the secret must not leak through response timing.
		if (presentedSecret === null || !secureEquals(presentedSecret, this.expectedSecret)) {
			throw new AuthenticationError({ code: "CALLBACK_UNAUTHORIZED", message: "Invalid processing callback secret" });
		}
	}
}
