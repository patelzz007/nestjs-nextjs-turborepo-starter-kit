import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreatePolicyDraftInput, PolicySimulationResult } from "@workspace/shared";
import { createHash } from "node:crypto";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "./cedar-policy-evaluator.service";
import { PolicyTemplateCompiler } from "./policy-template.compiler";

@Injectable()
export class PolicyControlPlaneService {
	private readonly compiler: PolicyTemplateCompiler = new PolicyTemplateCompiler();

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly cedar: CedarPolicyEvaluatorService,
	) {}

	public async createDraft(actorUserId: string, organizationId: string | null, input: CreatePolicyDraftInput): Promise<{ draftId: string }> {
		const compiled = this.compiler.compile(input.builderPayload, organizationId);

		const draft = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Create policy draft",
				correlationId: `draft:${input.name}`,
				actorUserId,
			},
			async (tx) => {
				return tx.authorizationPolicyDraft.create({
					data: {
						organizationId,
						scope: input.scope,
						name: input.name,
						description: input.description ?? null,
						builderPayload: input.builderPayload,
						cedarSource: compiled.cedarSource,
						sqlPredicate: compiled.sqlPredicate,
						status: "DRAFT",
						createdById: actorUserId,
					},
				});
			},
		);

		return { draftId: draft.id };
	}

	public async simulate(draftId: string, actorUserId: string): Promise<PolicySimulationResult> {
		const draft = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Simulate policy draft",
				correlationId: `simulate:${draftId}`,
				actorUserId,
			},
			async (tx) => tx.authorizationPolicyDraft.findUnique({ where: { id: draftId } }),
		);

		if (draft === null) {
			throw new BadRequestException("Draft not found");
		}

		const wouldLockOutOwners = draft.cedarSource.includes("removeLastOwner") && !draft.cedarSource.includes("OWNER");
		const passed = !wouldLockOutOwners;

		const result: PolicySimulationResult = {
			passed,
			warnings: wouldLockOutOwners ? ["Policy may remove last owner"] : [],
			errors: passed ? [] : ["Last-owner safeguard violated"],
			affectedPrincipalCount: 0,
			wouldLockOutOwners,
		};

		await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Persist simulation result",
				correlationId: `simulate-save:${draftId}`,
				actorUserId,
			},
			async (tx) => {
				await tx.authorizationPolicySimulation.create({
					data: {
						draftId,
						actorUserId,
						result,
						passed,
					},
				});
			},
		);

		return result;
	}

	public async publish(draftId: string, actorUserId: string): Promise<{ version: number }> {
		const draft = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Publish policy draft",
				correlationId: `publish:${draftId}`,
				actorUserId,
			},
			async (tx) => tx.authorizationPolicyDraft.findUnique({ where: { id: draftId } }),
		);

		if (draft?.status !== "DRAFT") {
			throw new BadRequestException("Draft not publishable");
		}

		const simulation = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Check simulation before publish",
				correlationId: `publish-check:${draftId}`,
				actorUserId,
			},
			async (tx) =>
				tx.authorizationPolicySimulation.findFirst({
					where: { draftId, passed: true },
					orderBy: { createdAt: "desc" },
				}),
		);

		if (simulation === null) {
			throw new BadRequestException("Policy must pass simulation before publish");
		}

		const contentHash = createHash("sha256").update(draft.cedarSource).digest("hex");
		const now = BigInt(Date.now());

		const versionRow = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Atomic policy version publish",
				correlationId: `publish-version:${draftId}`,
				actorUserId,
			},
			async (tx) => {
				const latest = await tx.authorizationPolicyVersion.findFirst({
					where: { organizationId: draft.organizationId, scope: draft.scope },
					orderBy: { version: "desc" },
				});
				const nextVersion = (latest?.version ?? 0) + 1;

				await tx.authorizationPolicyVersion.updateMany({
					where: { organizationId: draft.organizationId, scope: draft.scope, supersededAt: null },
					data: { supersededAt: now },
				});

				const version = await tx.authorizationPolicyVersion.create({
					data: {
						organizationId: draft.organizationId,
						draftId: draft.id,
						scope: draft.scope,
						version: nextVersion,
						cedarSource: draft.cedarSource,
						sqlPredicate: draft.sqlPredicate,
						contentHash,
						publishedAt: now,
						publishedById: actorUserId,
					},
				});

				await tx.authorizationPolicyDraft.update({
					where: { id: draftId },
					data: { status: "PUBLISHED", approvedById: actorUserId },
				});

				return version;
			},
		);

		if (draft.organizationId !== null) {
			this.cedar.invalidateOrganization(draft.organizationId);
		} else {
			this.cedar.invalidateOrganization("platform");
		}

		return { version: versionRow.version };
	}
}
