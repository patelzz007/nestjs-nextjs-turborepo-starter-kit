import type { EmailRenderContext } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildEmailPreview, listTemplateMeta } from "../../domain/templates/email-template.registry";
import { EmailPreviewApplicationService } from "../services/email-preview.application-service";

const CONTEXT: EmailRenderContext = { appName: "Rewards", appUrl: "https://app.example.com", supportEmail: "support@example.com" };

describe("EmailPreviewApplicationService", () => {
	it("lists every registered template's metadata", () => {
		expect(new EmailPreviewApplicationService(CONTEXT).listTemplates()).toEqual({ templates: listTemplateMeta() });
	});

	it("renders one template with its sample props in the configured app's context", () => {
		const service = new EmailPreviewApplicationService(CONTEXT);
		const [first] = listTemplateMeta();
		if (first === undefined) {
			throw new Error("the registry has no templates");
		}

		expect(service.preview(first.key)).toEqual(buildEmailPreview(first.key, CONTEXT));
	});
});
