import { describe, expect, it } from "vitest";

import { EmailTemplateKeySchema } from "@workspace/shared";

import { EmailRenderContextSchema } from "./base/email-render-context";
import { buildEmailPreview, EMAIL_TEMPLATE_REGISTRY, listTemplateMeta } from "./email-template.registry";

const context = EmailRenderContextSchema.parse({
	appName: "Acme Inc",
	appUrl: "https://app.example.com",
	supportEmail: "support@example.com",
});

describe("EmailTemplateRegistry", () => {
	it("covers every key in the shared EmailTemplateKeySchema (and nothing extra)", () => {
		const schemaKeys: readonly string[] = EmailTemplateKeySchema.options;
		const registryKeys: readonly string[] = Object.keys(EMAIL_TEMPLATE_REGISTRY);
		expect(registryKeys.sort()).toEqual([...schemaKeys].sort());
	});

	it("every registry entry builds a template with a valid preview", () => {
		for (const key of EmailTemplateKeySchema.options) {
			const preview = buildEmailPreview(key, context);
			expect(preview.key).toBe(key);
			expect(preview.html.length).toBeGreaterThan(100);
			expect(preview.text.length).toBeGreaterThan(10);
			expect(preview.subject.length).toBeGreaterThan(0);
			expect(preview.previewText.length).toBeGreaterThan(0);
			// Sample props render deterministically (no stray <script>).
			expect(preview.html).not.toContain("<script");
		}
	});

	it("metadata list matches the registry", () => {
		const meta = listTemplateMeta();
		expect(meta.length).toBe(Object.keys(EMAIL_TEMPLATE_REGISTRY).length);
		for (const entry of meta) {
			expect(EMAIL_TEMPLATE_REGISTRY[entry.key]).toBeDefined();
		}
	});

	it("rejects an out-of-schema key at the route-param schema boundary", () => {
		// The controller validates the param with EmailTemplateKeyParamSchema
		// before calling buildEmailPreview — the zod enum is the boundary.
		const result = EmailTemplateKeySchema.safeParse("does-not-exist");
		expect(result.success).toBe(false);
	});
});
