import { Injectable } from "@nestjs/common";
import type { TenantJobContext } from "@workspace/shared";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class TenantJobContextService {
	private readonly secret: string;

	public constructor() {
		this.secret = process.env.TENANT_JOB_HMAC_SECRET ?? "pilot-dev-job-secret-change-me";
	}

	public sign(context: Omit<TenantJobContext, "signature">): TenantJobContext {
		const payload = JSON.stringify({
			organizationId: context.organizationId,
			initiatingActorId: context.initiatingActorId,
			purpose: context.purpose,
			policyVersion: context.policyVersion,
			correlationId: context.correlationId,
			issuedAt: context.issuedAt,
			expiresAt: context.expiresAt,
		});
		const signature = createHmac("sha256", this.secret).update(payload).digest("hex");
		return { ...context, signature };
	}

	public verify(context: TenantJobContext): boolean {
		if (context.expiresAt < Date.now()) {
			return false;
		}
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
		if (a.length !== b.length) {
			return false;
		}
		return timingSafeEqual(a, b);
	}
}
