import type { MerchantKybProfileResponse } from "@workspace/shared";
import { JsonObjectSchema, JsonPrimitiveSchema } from "@workspace/shared";
import { z } from "zod";

import type { MerchantKybFieldValues } from "./fields";

const NonEmptyStringSchema = z.string().min(1);

export function readOrgString(value: string | null): string {
	const parsed = NonEmptyStringSchema.safeParse(value);
	return parsed.success ? parsed.data : "";
}

export function readKybStringField(profile: MerchantKybProfileResponse, key: string): string {
	if (profile.kybFields === null) {
		return "";
	}

	const kybFields = JsonObjectSchema.safeParse(profile.kybFields);
	if (!kybFields.success) {
		return "";
	}

	const parsed = JsonPrimitiveSchema.safeParse(kybFields.data[key]);
	if (!parsed.success || parsed.data === null) {
		return "";
	}
	return String(parsed.data);
}

export function profileToFieldValues(profile: MerchantKybProfileResponse): MerchantKybFieldValues {
	return {
		businessName: profile.businessName,
		legalName: readOrgString(profile.legalName),
		addressText: readOrgString(profile.addressText),
		contactPhone: readOrgString(profile.contactPhone),
		registrationNo: readKybStringField(profile, "registrationNo"),
		taxId: readKybStringField(profile, "taxId"),
		documentType: readKybStringField(profile, "documentType"),
		documents: [],
	};
}

export function kybStatusVariant(status: MerchantKybProfileResponse["kybStatus"]): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED" || status === "ACTION_REQUIRED") {
		return "destructive";
	}
	return "outline";
}
