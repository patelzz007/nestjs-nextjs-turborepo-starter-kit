import { beforeEach, describe, expect, it } from "vitest";
import type { PolicyBuilderPayload } from "@workspace/shared";

import { ValidationError } from "../../../../platform/application/errors/app-error";
import { SIMULATION_VALIDITY_MS, type PolicySlot } from "../../domain/aggregates/authorization-policy-draft.aggregate";
import {
	PolicyDraftNotFoundError,
	PolicyDraftNotPublishableError,
	PolicyImpersonationForbiddenError,
	PolicySelfApprovalForbiddenError,
	PolicySimulationFailedError,
	PolicySimulationRequiredError,
	PolicySimulationStaleError,
} from "../../domain/errors/authorization.errors";
import { CreatePolicyDraftCommand } from "../commands/create-policy-draft/create-policy-draft.command";
import { CreatePolicyDraftHandler } from "../commands/create-policy-draft/create-policy-draft.handler";
import { PublishPolicyCommand } from "../commands/publish-policy/publish-policy.command";
import { PublishPolicyHandler } from "../commands/publish-policy/publish-policy.handler";
import { SimulatePolicyDraftCommand } from "../commands/simulate-policy-draft/simulate-policy-draft.command";
import { SimulatePolicyDraftHandler } from "../commands/simulate-policy-draft/simulate-policy-draft.handler";
import type {
	PolicyCompilation,
	PolicySimulationRun,
	PolicySimulatorPort,
	PolicyTemplateCompilerPort,
	PolicyVersionStore,
	SimulatedDraft,
} from "../ports/policy-control-plane.port";
import type { PolicyEngine, PolicyEngineDecision, PolicyValidationResult } from "../ports/policy-engine.port";
import { InMemoryAuthorizationStore, adminActor } from "./fakes/authorization.fakes";

const ORG = "11111111-1111-4111-8111-111111111111";
const AUTHOR = "author-1";
const APPROVER = "approver-1";
const PAYLOAD: PolicyBuilderPayload = { templateId: "refund-approval", parameters: { role: "MANAGER" } };

/** Compiles every template to a fixed policy, or refuses the `broken` template. */
class ScriptedCompiler implements PolicyTemplateCompilerPort {
	public compile(payload: PolicyBuilderPayload): PolicyCompilation {
		return payload.templateId === "broken"
			? { kind: "invalid", message: "unknown template" }
			: { kind: "compiled", policy: { cedarSource: `permit(principal, action, resource); // ${payload.templateId}`, sqlPredicate: null } };
	}
}

/** Validates any source except one mentioning `forbid-everything`. */
class ScriptedEngine implements PolicyEngine {
	public validate(policySource: string): PolicyValidationResult {
		return policySource.includes("forbid-everything") ? { valid: false, errors: ["schema mismatch"] } : { valid: true };
	}

	public decide(): PolicyEngineDecision {
		throw new Error("decide is not used by the control plane");
	}
}

/** A simulation whose verdict the test sets; the baseline fingerprint is the count of active versions. */
class ScriptedSimulator implements PolicySimulatorPort {
	public passes = true;

	public async simulate(draft: SimulatedDraft, versions: PolicyVersionStore): Promise<PolicySimulationRun> {
		return {
			outcome: {
				passed: this.passes,
				warnings: [],
				errors: this.passes ? [] : ["locks out the owner"],
				evaluatedPrincipalCount: 3,
				affectedPrincipalCount: 1,
				wouldLockOutOwners: !this.passes,
				decisionChanges: [],
				decisionChangesTruncated: false,
			},
			baselineFingerprint: await this.currentBaselineFingerprint({ organizationId: draft.organizationId, scope: draft.scope }, versions),
		};
	}

	public async currentBaselineFingerprint(slot: PolicySlot, versions: PolicyVersionStore): Promise<string> {
		return `baseline:${String((await versions.baselineVersionIds(slot.organizationId)).length)}`;
	}
}

let store: InMemoryAuthorizationStore;
let simulator: ScriptedSimulator;

beforeEach(() => {
	store = new InMemoryAuthorizationStore();
	simulator = new ScriptedSimulator();
});

function create(builderPayload: PolicyBuilderPayload = PAYLOAD, isImpersonating = false): Promise<{ readonly draftId: string }> {
	return new CreatePolicyDraftHandler(store.uow, new ScriptedCompiler(), new ScriptedEngine(), store.clock).execute(
		new CreatePolicyDraftCommand(
			adminActor(AUTHOR, { isSuperAdmin: true }),
			{ userId: AUTHOR, isImpersonating },
			{ scope: "TENANT", organizationId: ORG, name: "Refunds", builderPayload },
		),
	);
}

function simulate(draftId: string, userId: string = AUTHOR): ReturnType<SimulatePolicyDraftHandler["execute"]> {
	return new SimulatePolicyDraftHandler(store.uow, simulator).execute(
		new SimulatePolicyDraftCommand(adminActor(userId, { isSuperAdmin: true }), { userId, isImpersonating: false }, draftId),
	);
}

function publish(draftId: string, approver: string = APPROVER): ReturnType<PublishPolicyHandler["execute"]> {
	return new PublishPolicyHandler(store.uow, simulator, store.clock).execute(
		new PublishPolicyCommand(adminActor(approver, { isSuperAdmin: true }), { userId: approver, isImpersonating: false }, { draftId, approvalNote: "reviewed" }),
	);
}

describe("CreatePolicyDraftHandler", () => {
	it("stores a compiled, validated draft with its audit row", async () => {
		const { draftId } = await create();

		expect(store.policyDrafts.rows.get(draftId)).toMatchObject({
			status: "DRAFT",
			organizationId: ORG,
			createdById: AUTHOR,
			cedarSource: "permit(principal, action, resource); // refund-approval",
		});
		expect(store.policyAudit.records.map((record) => record.action)).toEqual(["policy.draft.created"]);
	});

	it("refuses a payload that does not compile, or compiles to an invalid policy, and an impersonating author", async () => {
		await expect(create({ templateId: "broken", parameters: {} })).rejects.toBeInstanceOf(ValidationError);
		await expect(create({ templateId: "forbid-everything", parameters: {} })).rejects.toBeInstanceOf(ValidationError);
		await expect(create(PAYLOAD, true)).rejects.toBeInstanceOf(PolicyImpersonationForbiddenError);
		expect(store.policyDrafts.rows.size).toBe(0);
	});
});

describe("Simulate and publish (four eyes, D37)", () => {
	it("publishes a simulated draft as the next version of its slot, approved by a second person", async () => {
		const { draftId } = await create();
		await simulate(draftId);

		await expect(publish(draftId)).resolves.toEqual({ version: 1 });

		expect(store.policyVersions.lockedSlots).toEqual([{ organizationId: ORG, scope: "TENANT" }]);
		expect(store.policyVersions.versions).toEqual([expect.objectContaining({ draftId, version: 1, publishedById: APPROVER, supersededAt: null })]);
		expect(store.policyDrafts.rows.get(draftId)).toMatchObject({ status: "PUBLISHED", approvedById: APPROVER });
		expect(store.publishedEvents()).toEqual([expect.objectContaining({ draftId, version: 1 })]);
		await expect(publish(draftId)).rejects.toBeInstanceOf(PolicyDraftNotPublishableError);
	});

	it("records each simulation with its audit row in one unit of work", async () => {
		const { draftId } = await create();

		await simulate(draftId);

		expect(store.policySimulations.recorded).toHaveLength(1);
		expect(store.policyAudit.records.map((record) => record.action)).toEqual(["policy.draft.created", "policy.draft.simulated"]);
		expect(store.uow.committed.at(-1)?.operation).toBe("policy.draft.simulate");
	});

	it("supersedes the slot's active version when a newer one is published", async () => {
		const first = await create();
		await simulate(first.draftId);
		await publish(first.draftId);
		const second = await create();
		await simulate(second.draftId);

		await expect(publish(second.draftId)).resolves.toEqual({ version: 2 });

		expect(store.policyVersions.versions.map((version) => [version.version, version.supersededAt === null])).toEqual([
			[1, false],
			[2, true],
		]);
	});

	it("refuses self-approval, a missing or failed simulation, a stale one, and a stale baseline", async () => {
		const { draftId } = await create();
		await expect(publish(draftId, AUTHOR)).rejects.toBeInstanceOf(PolicySelfApprovalForbiddenError);
		await expect(publish(draftId)).rejects.toBeInstanceOf(PolicySimulationRequiredError);

		simulator.passes = false;
		await simulate(draftId);
		await expect(publish(draftId)).rejects.toBeInstanceOf(PolicySimulationFailedError);

		simulator.passes = true;
		await simulate(draftId);
		store.clock.advance(SIMULATION_VALIDITY_MS + 1);
		await expect(publish(draftId)).rejects.toBeInstanceOf(PolicySimulationStaleError);

		// A fresh simulation, then another policy goes live in the organization: the baseline moved.
		await simulate(draftId);
		const other = await create();
		await simulate(other.draftId);
		await publish(other.draftId);
		await expect(publish(draftId)).rejects.toBeInstanceOf(PolicySimulationStaleError);

		expect(store.policyVersions.versions.map((version) => version.draftId)).toEqual([other.draftId]);
		expect(store.policyDrafts.rows.get(draftId)?.status).toBe("DRAFT");
	});

	it("answers not found for an unknown draft", async () => {
		await expect(simulate("ghost")).rejects.toBeInstanceOf(PolicyDraftNotFoundError);
		await expect(publish("ghost")).rejects.toBeInstanceOf(PolicyDraftNotFoundError);
	});
});
