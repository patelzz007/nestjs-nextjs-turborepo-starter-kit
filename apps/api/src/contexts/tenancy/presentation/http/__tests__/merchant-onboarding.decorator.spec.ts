import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { MerchantOnboardingController } from "../merchant-onboarding.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(MerchantOnboardingController.prototype, name);
}

describe("merchant onboarding routes", () => {
	const reflector = new Reflector();

	it("names the operation each route runs under, and none keep the route-wide bypass", () => {
		const operations: Readonly<Record<string, string>> = {
			validateInvite: "tenant.invitation.resolve_token",
			completeOnboarding: "tenant.invitation.accept_merchant_onboarding",
			createDocumentUploadUrl: "tenant.onboarding.document_file",
			createDocumentUploadUrls: "tenant.onboarding.document_file",
			completeDocumentUpload: "tenant.onboarding.document_file",
			completeDocumentUploads: "tenant.onboarding.document_file",
			submitDocuments: "tenant.invitation.submit_onboarding_documents",
			documentStatus: "tenant.onboarding.document_file",
		};

		for (const [name, operation] of Object.entries(operations)) {
			expect(reflector.get(PUBLIC_OPERATION_KEY, handler(name))).toBe(operation);
		}
	});
});
