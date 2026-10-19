import { Inject, Injectable } from "@nestjs/common";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { ApiKeyVerificationPort, MerchantApiKeyAuthContext } from "../../../../platform/application/ports/api-key-verification.port";
import { sha256Hex } from "../../../../platform/infrastructure/crypto/sha256";
import { PrismaService } from "../../../../prisma/prisma.service";
import { createOrganizationsTransactionalPorts } from "../../../organizations/public-api";
import { OrganizationNotActiveError } from "../../domain/errors/pos.errors";
import { API_KEY_SCOPE_CAPABILITIES } from "../../domain/policies/api-key-scope.policy";

/**
 * {@link ApiKeyVerificationPort} for merchant keys. Runs in the guards' pre-handler phase (its own
 * named system-operation scope), before the request has a principal. A key paired to a terminal dies
 * with it; a valid key of a suspended / deactivated merchant authenticates but may do nothing.
 *
 * `lastUsedAt` is written before the request proceeds (awaited), not fire-and-forget as plan §7.3
 * sketched: the write must run inside the guard's system-operation RLS scope, which ends when
 * `verify` returns, so a detached write would run with no principal and be refused.
 */
@Injectable()
export class PrismaApiKeyVerifier implements ApiKeyVerificationPort {
	public constructor(
		private readonly prisma: PrismaService,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async verify(plaintext: string): Promise<MerchantApiKeyAuthContext | null> {
		const key = await this.prisma.organizationApiKey.findFirst({
			where: { keyHash: sha256Hex(plaintext), isDeleted: false, revokedAt: null },
			select: { id: true, organizationId: true, locationId: true, scope: true, terminal: { select: { id: true, terminalId: true, locationId: true, isDeleted: true } } },
		});
		if (key === null || key.terminal?.isDeleted === true) {
			return null;
		}
		const organization = await createOrganizationsTransactionalPorts(this.prisma).merchantPosSettings.tillOrganization(key.organizationId);
		if (organization?.operating !== true) {
			throw new OrganizationNotActiveError();
		}
		await this.prisma.organizationApiKey.update({ where: { id: key.id }, data: { lastUsedAt: this.clock.now() }, select: { id: true } });
		return {
			provider: "merchant",
			apiKeyId: key.id,
			organizationId: key.organizationId,
			locationId: key.locationId,
			terminal: key.terminal === null ? null : { id: key.terminal.id, terminalId: key.terminal.terminalId, locationId: key.terminal.locationId },
			requireRegisteredTerminals: organization.requireRegisteredTerminals,
			scope: key.scope,
			capabilities: API_KEY_SCOPE_CAPABILITIES[key.scope],
		};
	}
}
