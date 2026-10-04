import { hostname, userInfo } from "node:os";

/** Who ran the command: recorded in the audit rows next to the system actor. */
export interface OperatorIdentity {
	readonly osUser: string;
	readonly host: string;
}

/** Placeholder when the operating system cannot say (no passwd entry for the uid, e.g. a minimal container). */
export const UNKNOWN_OPERATOR_FIELD = "unknown";

export interface OperatorIdentityProvider {
	current(): OperatorIdentity;
}

/** The OS user and hostname of the process. */
export class NodeOperatorIdentityProvider implements OperatorIdentityProvider {
	public current(): OperatorIdentity {
		return { osUser: this.osUser(), host: this.host() };
	}

	private osUser(): string {
		try {
			return userInfo().username;
		} catch {
			// `userInfo()` throws when the uid has no passwd entry; the audit row still names the host.
			return UNKNOWN_OPERATOR_FIELD;
		}
	}

	private host(): string {
		return hostname() || UNKNOWN_OPERATOR_FIELD;
	}
}
