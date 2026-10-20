import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { ValidationError } from "../../application/errors/app-error";

/** The fields that would select a tenant. One list, checked the same way in the path, the query and the body. */
const TenantSelectorSchema = z.looseObject({
	tenantId: z.string().optional(),
	tenantSlug: z.string().optional(),
});

/**
 * A machine credential already names its tenant. A slug or tenant id in the path, the query or the
 * body is a second selector and is rejected with 400. The `x-tenant-id` header is not one: POS
 * clients send it on every call as information only, and nothing reads it.
 */
export function rejectMachineTenantSelector(request: FastifyRequest): void {
	const parts = [request.params, request.query, request.body].map(readSelector);
	if (parts.some((part) => part.tenantId !== undefined || part.tenantSlug !== undefined)) {
		throw new ValidationError({
			code: "TENANT_SELECTOR_NOT_ALLOWED",
			message: "A machine credential names its tenant. Do not also send a tenant slug or tenant id.",
		});
	}
}

function readSelector(source: FastifyRequest["body"]): z.output<typeof TenantSelectorSchema> {
	const parsed = TenantSelectorSchema.safeParse(source);
	return parsed.success ? parsed.data : {};
}
