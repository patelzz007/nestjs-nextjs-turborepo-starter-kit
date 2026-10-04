import { BadRequestException, Injectable } from "@nestjs/common";
import type { OrganizationLifecycleState } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationLifecycleEventRecorder } from "./organization-lifecycle-event.recorder";

const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizationLifecycleService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly lifecycleEvents: OrganizationLifecycleEventRecorder,
	) {}

	public async requestDeletion(organizationId: string, actorUserId: string, confirmDisplayName: string): Promise<void> {
		await this.tenantTx.withTenantTransaction(
			{
				userId: actorUserId,
				organizationId,
				purpose: "organization.request_deletion",
				policyVersion: 0,
			},
			async (tx) => {
				const org = await tx.organization.findUnique({ where: { id: organizationId } });
				if (org?.displayName !== confirmDisplayName) {
					throw new BadRequestException("Display name confirmation does not match");
				}
				const graceEnds = BigInt(Date.now() + DELETION_GRACE_MS);
				await tx.organization.update({
					where: { id: organizationId },
					data: {
						lifecycleState: "PENDING_DELETION",
						deletionGraceEndsAt: graceEnds,
					},
				});
				await this.lifecycleEvents.recordInTx(tx, {
					organizationId,
					fromState: org.lifecycleState,
					toState: "PENDING_DELETION",
					actorUserId,
					reason: "Owner requested deletion",
				});
			},
		);
	}

	public async transitionState(organizationId: string, toState: OrganizationLifecycleState, actorUserId: string | null, reason: string): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.lifecycle.transition",
				reason,
				actorUserId,
			},
			async (tx) => {
				const org = await tx.organization.findUnique({ where: { id: organizationId } });
				if (org === null) {
					throw new BadRequestException("Organization not found");
				}
				await tx.organization.update({
					where: { id: organizationId },
					data: { lifecycleState: toState },
				});
				await this.lifecycleEvents.recordInTx(tx, { organizationId, fromState: org.lifecycleState, toState, actorUserId, reason });
			},
		);
	}
}
