import { Inject, Injectable } from "@nestjs/common";
import type { AuthorizationPolicyDraft } from "@prisma/client";
import type { CedarDecision, PolicyDecisionChange, PolicySimulationResult } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import {
	MAX_REPORTED_DECISION_CHANGES,
	MAX_REPORTED_LOCKOUT_ORGANIZATIONS,
	MAX_SIMULATED_PRINCIPALS,
	OWNER_CRITICAL_CEDAR_ACTION,
	OWNER_MEMBERSHIP_ROLE,
	SIMULATED_CEDAR_ACTIONS,
	SIMULATION_PAGE_SIZE,
} from "../constants/policy-control-plane.constants";
import {
	PolicyControlPlaneRepository,
	type ActivePolicyVersion,
	type PolicyControlPlaneDbClient,
	type SimulationPrincipal,
} from "../repositories/policy-control-plane.repository";
import { policyBaselineFingerprint } from "./policy-baseline";
import { POLICY_ENGINE, type PolicyBundle, type PolicyEngine, type PolicyRequest } from "../engine/policy-engine.port";
import { composePolicyBundle, isVersionInOrganizationBundle, type PolicyBundleSource } from "./policy-bundle";

/** The simulation result before it is persisted (the id is assigned by the recorder). */
export type PolicySimulationOutcome = Omit<PolicySimulationResult, "simulationId">;

export interface PolicySimulationRun {
	readonly outcome: PolicySimulationOutcome;
	/** Fingerprint of the published versions the draft was compared against. */
	readonly baselineFingerprint: string;
}

/** The fields of a draft the simulation reads. */
export type SimulatedDraft = Pick<AuthorizationPolicyDraft, "organizationId" | "scope" | "cedarSource">;

/** A draft has no version number yet; it never wins the bundle's reported version. */
const DRAFT_SOURCE_VERSION = 0;

interface OwnerAccess {
	before: number;
	after: number;
}

interface OrganizationBundles {
	readonly current: PolicyBundle;
	readonly candidate: PolicyBundle;
}

/** Mutable accumulator of one simulation run. */
interface SimulationTally {
	evaluated: number;
	affected: number;
	readonly changes: PolicyDecisionChange[];
	truncated: boolean;
	readonly ownerAccess: Map<string, OwnerAccess>;
}

/** The organization a simulation evaluates principals in: one tenant, or (`null`) every organization. */
export function simulatedOrganizationId(draft: Pick<AuthorizationPolicyDraft, "organizationId" | "scope">): string | null {
	return draft.scope === "TENANT" ? draft.organizationId : null;
}

/**
 * Evaluates a policy draft against the currently published policy set over
 * the real principals (active organization memberships) in its scope, with
 * the SAME engine the runtime decides with (the {@link PolicyEngine} port —
 * the official Cedar engine), on the same request shape.
 *
 * Work is bounded: memberships are read in keyset pages of
 * {@link SIMULATION_PAGE_SIZE}, each in its own short read transaction, and a
 * scope with more than {@link MAX_SIMULATED_PRINCIPALS} principals fails the
 * simulation instead of being evaluated.
 */
@Injectable()
export class PolicySimulationService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly repository: PolicyControlPlaneRepository,
		@Inject(POLICY_ENGINE) private readonly engine: PolicyEngine,
	) {}

	public async simulate(draft: SimulatedDraft, actorUserId: string): Promise<PolicySimulationRun> {
		const organizationId: string | null = simulatedOrganizationId(draft);
		const baselineIds: string[] = await this.read(actorUserId, "Read the policy baseline for simulation", (db) => this.repository.findBaselineVersionIds(organizationId, db));
		const tally: SimulationTally = { evaluated: 0, affected: 0, changes: [], truncated: false, ownerAccess: new Map<string, OwnerAccess>() };

		// Fail fast (one COUNT) when the scope is too large to simulate exhaustively.
		const principalCount: number = await this.read(actorUserId, "Count principals for policy simulation", (db) => this.repository.countActivePrincipals(organizationId, db));
		if (principalCount > MAX_SIMULATED_PRINCIPALS) {
			return { outcome: this.buildOutcome(draft, tally, true), baselineFingerprint: policyBaselineFingerprint(baselineIds) };
		}

		let cursor: string | null = null;
		let limitExceeded = false;
		for (;;) {
			const afterId: string | null = cursor;
			const page: SimulationPrincipal[] = await this.read(actorUserId, "Read principals for policy simulation", (db) =>
				this.repository.listActivePrincipals(organizationId, afterId, SIMULATION_PAGE_SIZE, db),
			);
			const last: SimulationPrincipal | undefined = page.at(-1);
			if (last === undefined) {
				break;
			}
			// Memberships created after the COUNT still cannot push the run past the limit.
			if (tally.evaluated + page.length > MAX_SIMULATED_PRINCIPALS) {
				limitExceeded = true;
				break;
			}
			await this.evaluatePage(draft, page, actorUserId, tally);
			cursor = last.id;
			if (page.length < SIMULATION_PAGE_SIZE) {
				break;
			}
		}

		return { outcome: this.buildOutcome(draft, tally, limitExceeded), baselineFingerprint: policyBaselineFingerprint(baselineIds) };
	}

	/** Recomputes the baseline fingerprint (publish compares it with the simulated one). */
	public async currentBaselineFingerprint(draft: Pick<AuthorizationPolicyDraft, "organizationId" | "scope">, db: PolicyControlPlaneDbClient): Promise<string> {
		return policyBaselineFingerprint(await this.repository.findBaselineVersionIds(simulatedOrganizationId(draft), db));
	}

	private async read<T>(actorUserId: string, reason: string, work: (db: PolicyControlPlaneDbClient) => Promise<T>): Promise<T> {
		return this.tenantTx.withSystemOperation({ operation: "policy.draft.simulate", reason, actorUserId }, work);
	}

	private async evaluatePage(draft: SimulatedDraft, page: readonly SimulationPrincipal[], actorUserId: string, tally: SimulationTally): Promise<void> {
		const organizationIds: string[] = [...new Set(page.map((principal: SimulationPrincipal): string => principal.organizationId))];
		const versions: ActivePolicyVersion[] = await this.read(actorUserId, "Read published policies for simulation", (db) =>
			this.repository.findActiveVersionsForOrganizations(organizationIds, db),
		);
		const bundles = new Map<string, OrganizationBundles>(organizationIds.map((id: string): [string, OrganizationBundles] => [id, this.bundlesFor(draft, versions, id)]));

		for (const principal of page) {
			const organizationBundles: OrganizationBundles | undefined = bundles.get(principal.organizationId);
			if (organizationBundles === undefined) {
				throw new Error(`Policy simulation built no bundle for organization ${principal.organizationId}`);
			}
			this.evaluatePrincipal(principal, organizationBundles, tally);
		}
		tally.evaluated += page.length;
	}

	/** The organization's bundle as published, and as it would be with the draft published in its slot. */
	private bundlesFor(draft: SimulatedDraft, versions: readonly ActivePolicyVersion[], organizationId: string): OrganizationBundles {
		const inBundle: ActivePolicyVersion[] = versions.filter((version: ActivePolicyVersion): boolean => isVersionInOrganizationBundle(version, organizationId));
		const draftSource: PolicyBundleSource = { organizationId: draft.organizationId, scope: draft.scope, version: DRAFT_SOURCE_VERSION, cedarSource: draft.cedarSource };
		const kept: PolicyBundleSource[] = inBundle.filter(
			(version: ActivePolicyVersion): boolean => version.organizationId !== draft.organizationId || version.scope !== draft.scope,
		);
		const candidate: PolicyBundleSource[] = isVersionInOrganizationBundle(draftSource, organizationId) ? [...kept, draftSource] : kept;
		return { current: composePolicyBundle(inBundle), candidate: composePolicyBundle(candidate) };
	}

	private evaluatePrincipal(principal: SimulationPrincipal, bundles: OrganizationBundles, tally: SimulationTally): void {
		let changed = false;
		for (const action of SIMULATED_CEDAR_ACTIONS) {
			const request: PolicyRequest = {
				organizationId: principal.organizationId,
				principal: { userId: principal.userId, role: principal.role, locationScope: principal.locationScope, locationIds: principal.locationIds },
				action,
			};
			const before: CedarDecision = this.engine.decide(bundles.current, request).decision;
			const after: CedarDecision = this.engine.decide(bundles.candidate, request).decision;
			if (action === OWNER_CRITICAL_CEDAR_ACTION && principal.role === OWNER_MEMBERSHIP_ROLE) {
				this.countOwnerAccess(tally, principal.organizationId, before, after);
			}
			if (before === after) {
				continue;
			}
			changed = true;
			if (tally.changes.length < MAX_REPORTED_DECISION_CHANGES) {
				tally.changes.push({ organizationId: principal.organizationId, userId: principal.userId, membershipRole: principal.role, action, before, after });
			} else {
				tally.truncated = true;
			}
		}
		if (changed) {
			tally.affected += 1;
		}
	}

	private countOwnerAccess(tally: SimulationTally, organizationId: string, before: CedarDecision, after: CedarDecision): void {
		const access: OwnerAccess = tally.ownerAccess.get(organizationId) ?? { before: 0, after: 0 };
		access.before += before === "Allow" ? 1 : 0;
		access.after += after === "Allow" ? 1 : 0;
		tally.ownerAccess.set(organizationId, access);
	}

	private buildOutcome(draft: SimulatedDraft, tally: SimulationTally, limitExceeded: boolean): PolicySimulationOutcome {
		const lockedOut: string[] = [...tally.ownerAccess.entries()]
			.filter(([, access]: [string, OwnerAccess]): boolean => access.before > 0 && access.after === 0)
			.map(([organizationId]: [string, OwnerAccess]): string => organizationId);
		const errors: string[] = [];
		if (limitExceeded) {
			errors.push(`The policy scope has more than ${String(MAX_SIMULATED_PRINCIPALS)} principals; it cannot be simulated exhaustively`);
		}
		if (lockedOut.length > 0) {
			const named: string = lockedOut.slice(0, MAX_REPORTED_LOCKOUT_ORGANIZATIONS).join(", ");
			errors.push(`Owners would lose ${OWNER_CRITICAL_CEDAR_ACTION} in ${String(lockedOut.length)} organization(s): ${named}`);
		}
		const warnings: string[] = [];
		if (draft.scope === "PLATFORM") {
			warnings.push("PLATFORM-scope policies are not part of any runtime policy bundle; publishing this draft changes no authorization decision");
		}
		if (tally.affected > 0) {
			warnings.push(`${String(tally.affected)} principal(s) would get at least one different decision`);
		}
		return {
			passed: errors.length === 0,
			warnings,
			errors,
			evaluatedPrincipalCount: tally.evaluated,
			affectedPrincipalCount: tally.affected,
			wouldLockOutOwners: lockedOut.length > 0,
			decisionChanges: tally.changes,
			decisionChangesTruncated: tally.truncated,
		};
	}
}
