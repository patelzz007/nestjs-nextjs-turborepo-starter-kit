import type { ActorContext } from "../../actor-context";
import type { AuthorizationCheck, AuthorizationPort } from "../../ports/authorization.port";
import { AuthorizationDeniedError } from "../../../domain/errors/authorization-denied.error";

/** `"allow"` lets every check through; `"deny"` refuses every check. */
export type FakeAuthorizationDecision = "allow" | "deny";

/** One check the fake was asked, with the actor that asked it. */
export interface RecordedAuthorizationCheck {
	readonly actor: ActorContext;
	readonly check: AuthorizationCheck;
}

/**
 * A real {@link AuthorizationPort}: allows or denies by configuration, and
 * throws the same {@link AuthorizationDeniedError} the kernel adapter throws.
 * A rule per `action:resource` overrides the default decision.
 */
export class FakeAuthorizationPort implements AuthorizationPort {
	public readonly checks: RecordedAuthorizationCheck[] = [];
	private readonly rules: Map<string, FakeAuthorizationDecision> = new Map<string, FakeAuthorizationDecision>();

	public constructor(private readonly fallback: FakeAuthorizationDecision = "allow") {}

	/** Decide `action` on `resource` explicitly, whatever the default is. */
	public decide(action: string, resource: string, decision: FakeAuthorizationDecision): this {
		this.rules.set(ruleKey(action, resource), decision);
		return this;
	}

	public can(actor: ActorContext, check: AuthorizationCheck): Promise<boolean> {
		this.checks.push({ actor, check });
		return Promise.resolve(this.decisionFor(check) === "allow");
	}

	public async assertAllowed(actor: ActorContext, check: AuthorizationCheck): Promise<void> {
		if (!(await this.can(actor, check))) {
			throw new AuthorizationDeniedError(check.action, check.resource);
		}
	}

	private decisionFor(check: AuthorizationCheck): FakeAuthorizationDecision {
		return this.rules.get(ruleKey(check.action, check.resource)) ?? this.fallback;
	}
}

function ruleKey(action: string, resource: string): string {
	return `${action}:${resource}`;
}
