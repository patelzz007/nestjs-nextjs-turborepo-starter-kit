"use client";

import { isStringPrimitive } from "@workspace/shared";
import { useParams } from "next/navigation";

/** Name of the dynamic segment under `app/t/` that carries the tenant. */
export const TENANT_SLUG_ROUTE_PARAM = "tenantSlug";

/**
 * Active tenant slug — read from the `/t/[tenantSlug]` URL segment, the
 * single owner of the tenant (never mirrored into React or Zustand state).
 * `undefined` outside tenant routes (e.g. `/auth/verify-email`): tenant-relative
 * links then point at the top-level entry pages, which resolve the
 * tenant server-side from the `tenantSlug` cookie (`resolveTenantHref`).
 */
export function useTenantSlug(): string | undefined {
	const segment = useParams()[TENANT_SLUG_ROUTE_PARAM];
	return isStringPrimitive(segment) && segment.length > 0 ? segment : undefined;
}
