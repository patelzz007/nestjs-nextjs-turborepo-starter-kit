// ============================================
// application/services/access-control.service.ts — the ONE place an access decision is made (ADR 067)
// ============================================
// Design patterns and SOLID:
//   - FACADE: callers (the route guard, the merchant capability gate, a service
//     checking one record) ask `decide` / `require`; they never see facts,
//     paths or the clock.
//   - COMPOSITION over inheritance: the decider is assembled here from the four
//     allow-path STRATEGIES, in order.
//   - Dependency Inversion: facts, ownership and the clock are ports, injected.
//   - Single Responsibility: deciding; auditing is the caller's (the kernel
//     facade records every audited decision with its allow path).

import { Inject, Injectable } from "@nestjs/common";
import type { PermissionPair } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { AccessDecider } from "../../domain/access/access-decider";
import type { AccessFacts } from "../../domain/access/access-facts";
import { isLiveAt } from "../../domain/access/access-facts";
import { DENIED, type AccessDecision, type AccessRequest } from "../../domain/access/access-request";
import { GrantAllowPath, OwnershipAllowPath, RoleAllowPath, ShareAllowPath, type RecordOwnership } from "../../domain/access/allow-paths";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import type { AccessControlPort } from "../ports/access-control.port";
import { ACCESS_FACTS_READER, RECORD_OWNERSHIP, type AccessFactsReader } from "../ports/access-facts.port";

@Injectable()
export class AccessControlService implements AccessControlPort {
	private readonly decider: AccessDecider;

	public constructor(
		@Inject(ACCESS_FACTS_READER) private readonly facts: AccessFactsReader,
		@Inject(RECORD_OWNERSHIP) ownership: RecordOwnership,
		@Inject(CLOCK) private readonly clock: Clock,
	) {
		this.decider = new AccessDecider([new RoleAllowPath(), new GrantAllowPath(), new ShareAllowPath(), new OwnershipAllowPath(ownership)]);
	}

	/** Allowed or not, and which path allowed it. A tenant request with no active membership is denied. */
	public async decide(request: AccessRequest): Promise<AccessDecision> {
		const facts = await this.facts.read(request.userId, request.tenantId);
		return facts === null ? DENIED : this.decider.decide(request, facts, this.clock.now());
	}

	/** {@link decide}, throwing the uniform 403 on a denial. Returns the allow path for auditing. */
	public async require(request: AccessRequest): Promise<AccessDecision> {
		const decision = await this.decide(request);
		if (!decision.allowed) {
			throw new AccessDeniedError();
		}
		return decision;
	}

	/**
	 * Every permission the caller holds right now through their role or a live grant — what a UI shows.
	 * Store- and record-specific rights still need a real decision; this only says what to offer.
	 */
	public async effectivePermissions(userId: string, tenantId: string | undefined): Promise<readonly PermissionPair[]> {
		const facts: AccessFacts | null = await this.facts.read(userId, tenantId);
		if (facts === null) {
			return [];
		}
		const now = this.clock.now();
		return [...facts.rolePermissions, ...facts.grants.filter((grant) => isLiveAt(grant.expiresAt, now)).map((grant) => grant.permission)];
	}
}
