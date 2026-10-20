"use client";

import { isStringPrimitive } from "@workspace/shared";
import { useParams } from "next/navigation";

/** Name of the dynamic segment under `app/orgs/` that carries the tenant. */
export const ORG_SLUG_ROUTE_PARAM = "orgSlug";

/**
 * Active organization slug — read from the `/orgs/[orgSlug]` URL segment, the
 * single owner of the tenant (never mirrored into React or Zustand state).
 * `undefined` outside org routes (e.g. `/auth/verify-email`): org-relative
 * links then point at the top-level entry pages, which resolve the
 * organization server-side from the `organizationSlug` cookie (`resolveOrgHref`).
 */
export function useOrganizationSlug(): string | undefined {
	const segment = useParams()[ORG_SLUG_ROUTE_PARAM];
	return isStringPrimitive(segment) && segment.length > 0 ? segment : undefined;
}
