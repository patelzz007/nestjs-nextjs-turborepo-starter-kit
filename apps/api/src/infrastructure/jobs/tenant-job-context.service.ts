import { Injectable } from "@nestjs/common";
import type { TenantJobContext } from "@workspace/shared";
import { createHmac, timingSafeEqual } from "node:crypto";

import { TypedConfigService } from "../../config/typed-config.service";

/** Thrown when a tenant job context must be signed but `TENANT_JOB_HMAC_SECRET` is not configured. */
export class TenantJobSigningNotConfiguredError extends Error {
	public constructor() {
		super("TENANT_JOB_HMAC_SECRET is not configured — tenant job contexts cannot be signed.");
		this.name = "TenantJobSigningNotConfiguredError";
	}
}

/**
 * HMAC-signs tenant job contexts so a queue worker can trust the tenant a job
 * claims. There is NO default secret: without `TENANT_JOB_HMAC_SECRET`,
 * `sign` throws and `verify` rejects everything (fail closed).
 */
@Injectable()
export class TenantJobContextService {
	private readonly secret: string | null;

	public constructor(config: TypedConfigService) {
		this.secret = config.encryption.tenantJobHmacSecret;
	}

	public sign(context: Omit<TenantJobContext, "signature">): TenantJobContext {
		const secret: string = this.requireSecret();
		const payload = JSON.stringify({
			organizationId: context.organizationId,
			initiatingActorId: context.initiatingActorId,
			purpose: context.purpose,
			policyVersion: context.policyVersion,
			correlationId: context.correlationId,
			issuedAt: context.issuedAt,
			expiresAt: context.expiresAt,
		});
		const signature = createHmac("sha256", secret).update(payload).digest("hex");
		return { ...context, signature };
	}

	public verify(context: TenantJobContext): boolean {
		if (this.secret === null || context.expiresAt < Date.now()) return false;

		const expected = this.sign({
			organizationId: context.organizationId,
			initiatingActorId: context.initiatingActorId,
			purpose: context.purpose,
			policyVersion: context.policyVersion,
			correlationId: context.correlationId,
			issuedAt: context.issuedAt,
			expiresAt: context.expiresAt,
		});
		const a = Buffer.from(context.signature);
		const b = Buffer.from(expected.signature);
		if (a.length !== b.length) return false;

		return timingSafeEqual(a, b);
	}

	private requireSecret(): string {
		if (this.secret === null) {
			throw new TenantJobSigningNotConfiguredError();
		}
		return this.secret;
	}
}
