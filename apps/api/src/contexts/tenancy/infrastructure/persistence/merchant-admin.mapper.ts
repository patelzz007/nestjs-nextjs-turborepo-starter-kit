import type { Tenant, TenantLifecycleState, TenantMerchantProfile, Prisma } from "@prisma/client";
import { epochMs, JsonObjectSchema, type AdminMerchantDetailResponse, type JsonObject, type MerchantKybDocumentRecord, type MerchantOrgResponse } from "@workspace/shared";

import type { ADMIN_ORG_DETAIL_INCLUDE } from "./prisma-merchant-admin.read-repository";

export type TenantAdminDetailRow = Prisma.TenantGetPayload<{ include: typeof ADMIN_ORG_DETAIL_INCLUDE }>;

/** The tenant lifecycle as the merchant-facing status. */
export function merchantStatusOf(lifecycleState: TenantLifecycleState): MerchantOrgResponse["status"] {
	if (lifecycleState === "ACTIVE") {
		return "ACTIVE";
	}
	if (lifecycleState === "SUSPENDED") {
		return "SUSPENDED";
	}
	return "ONBOARDING";
}

function parseKybFields(value: Prisma.JsonValue | null): JsonObject | null {
	if (value === null) {
		return null;
	}
	const parsed = JsonObjectSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function toMerchantOrgResponse(org: Tenant & { readonly merchantProfile: TenantMerchantProfile | null }): MerchantOrgResponse {
	const profile = org.merchantProfile;
	return {
		id: org.id,
		businessName: org.displayName,
		legalName: profile?.legalName ?? null,
		category: profile?.category ?? "",
		addressText: profile?.addressText ?? null,
		city: profile?.city ?? "KUALA_LUMPUR",
		kybStatus: profile?.kybStatus ?? "PENDING",
		status: merchantStatusOf(org.lifecycleState),
		contactEmail: profile?.contactEmail ?? "",
		contactPhone: profile?.contactPhone ?? null,
		createdAt: epochMs(Number(org.createdAt)),
		updatedAt: epochMs(Number(org.updatedAt)),
		isDeleted: org.isDeleted,
		deletedAt: org.deletedAt === null ? null : epochMs(Number(org.deletedAt)),
	};
}

export function toMerchantDetailResponse(
	org: TenantAdminDetailRow,
	documents: readonly MerchantKybDocumentRecord[],
	locations: AdminMerchantDetailResponse["locations"],
): AdminMerchantDetailResponse {
	const ownerMember = org.memberships.find((member) => member.role === "OWNER");
	return {
		...toMerchantOrgResponse(org),
		kybFields: parseKybFields(org.merchantProfile?.kybFields ?? null),
		documents: [...documents],
		locations: [...locations],
		ownerUserId: ownerMember?.userId ?? null,
		ownerEmail: ownerMember?.user.email ?? null,
		ownerFullName: ownerMember?.user.fullName ?? null,
		memberCount: org._count.memberships,
	};
}
