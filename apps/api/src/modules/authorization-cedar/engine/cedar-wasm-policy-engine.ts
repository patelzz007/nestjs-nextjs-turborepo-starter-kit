import {
	preparseSchema,
	statefulIsAuthorized,
	validate,
	type AuthorizationAnswer,
	type DetailedError,
	type EntityJson,
	type ValidationAnswer,
	type ValidationError,
} from "@cedar-policy/cedar-wasm/nodejs";

import { CEDAR_ENTITY_TYPES, CEDAR_SCHEMA_NAME, qualifiedCedarType, REWARDHUB_CEDAR_SCHEMA } from "../cedar/rewardhub-cedar-model";
import { PREPARSED_POLICY_SET_CACHE, PreparsedPolicySetCache } from "./preparsed-policy-set-cache";
import { PolicyEngineError, type PolicyBundle, type PolicyEngine, type PolicyEngineDecision, type PolicyRequest, type PolicyValidationResult } from "./policy-engine.port";

const POLICY_SEPARATOR = "\n";
const STRICT_VALIDATION = "strict";

function messagesOf(errors: readonly DetailedError[]): string[] {
	return errors.map((error: DetailedError): string => error.message);
}

/**
 * The official Cedar engine (`@cedar-policy/cedar-wasm`) behind the
 * {@link PolicyEngine} port.
 *
 * - Policies are validated strictly against the schema; policy-level
 *   validation warnings count as failures.
 * - Requests are validated against {@link REWARDHUB_CEDAR_SCHEMA}
 *   (`validateRequest`): an undeclared action or wrong entity type fails.
 * - Fail closed: if any policy ERRORS during evaluation, the decision is
 *   Deny (`evaluation_error`) — Cedar alone would skip the erroring policy,
 *   which could silently drop a `forbid`.
 * - Bundles are evaluated from a bounded pool of preparsed policy sets
 *   ({@link PreparsedPolicySetCache}); memory stays bounded however many
 *   policies are published over the process lifetime.
 * - An empty bundle denies (Cedar's default deny); every organization gets a
 *   published TENANT policy at provisioning.
 *
 * No constructor dependencies: Nest provides it under `POLICY_ENGINE`
 * (`useClass` in `AuthorizationCedarModule`) without a decorator.
 */
export class CedarWasmPolicyEngine implements PolicyEngine {
	public constructor(private readonly preparsed: PreparsedPolicySetCache = PREPARSED_POLICY_SET_CACHE) {
		const answer = preparseSchema(CEDAR_SCHEMA_NAME, REWARDHUB_CEDAR_SCHEMA);
		if (answer.type === "failure") {
			throw new PolicyEngineError("The RewardHub Cedar schema does not parse", messagesOf(answer.errors));
		}
	}

	public validate(policySource: string): PolicyValidationResult {
		const answer: ValidationAnswer = validate({
			schema: REWARDHUB_CEDAR_SCHEMA,
			policies: { staticPolicies: policySource },
			validationSettings: { mode: STRICT_VALIDATION },
		});
		if (answer.type === "failure") {
			return { valid: false, errors: messagesOf(answer.errors) };
		}
		// Policy-level warnings (e.g. "policy is impossible") are rejected too: a policy that can never
		// apply is always a mistake in a control plane that only publishes compiled templates.
		const problems: ValidationError[] = [...answer.validationErrors, ...answer.validationWarnings];
		if (problems.length > 0) {
			return { valid: false, errors: problems.map((problem: ValidationError): string => `${problem.policyId}: ${problem.error.message}`) };
		}
		return { valid: true };
	}

	public decide(bundle: PolicyBundle, request: PolicyRequest): PolicyEngineDecision {
		const principal = { type: qualifiedCedarType(CEDAR_ENTITY_TYPES.member), id: request.principal.userId };
		const resource = { type: qualifiedCedarType(CEDAR_ENTITY_TYPES.organization), id: request.organizationId };
		const entities: EntityJson[] = [
			{
				uid: principal,
				attrs: { role: request.principal.role, locationScope: request.principal.locationScope, locationIds: [...request.principal.locationIds] },
				parents: [],
			},
			{
				uid: resource,
				attrs: { organizationId: request.organizationId, ...(request.locationId === undefined ? {} : { locationId: request.locationId }) },
				parents: [],
			},
		];
		const answer: AuthorizationAnswer = statefulIsAuthorized({
			principal,
			action: { type: qualifiedCedarType(CEDAR_ENTITY_TYPES.action), id: request.action },
			resource,
			context: {},
			preparsedSchemaName: CEDAR_SCHEMA_NAME,
			validateRequest: true,
			preparsedPolicySetId: this.preparsed.slotFor(bundle.sources.join(POLICY_SEPARATOR)),
			entities,
		});
		if (answer.type === "failure") {
			throw new PolicyEngineError("Cedar could not evaluate the request", messagesOf(answer.errors));
		}
		const { decision, diagnostics } = answer.response;
		if (diagnostics.errors.length > 0) {
			return { decision: "Deny", diagnostic: "evaluation_error" };
		}
		if (decision === "allow") {
			return { decision: "Allow", diagnostic: "explicit_permit" };
		}
		return { decision: "Deny", diagnostic: diagnostics.reason.length > 0 ? "explicit_forbid" : "default_deny" };
	}
}
