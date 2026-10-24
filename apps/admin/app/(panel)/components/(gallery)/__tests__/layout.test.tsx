// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { FeatureFlagEnv } from "@/lib/feature-flags";

const NOT_FOUND = "NEXT_NOT_FOUND";

const deployment = vi.hoisted((): { env: FeatureFlagEnv } => ({ env: { NODE_ENV: "development", ADMIN_COMPONENT_GALLERY: undefined } }));

vi.mock("next/navigation", () => ({
	notFound: (): void => {
		throw new Error(NOT_FOUND);
	},
}));

vi.mock("next/headers", () => ({
	cookies: (): Promise<{ readonly get: () => undefined }> => Promise.resolve({ get: (): undefined => undefined }),
}));

vi.mock("@/lib/env/env.server", () => ({
	get serverEnv(): FeatureFlagEnv {
		return deployment.env;
	},
}));

const { default: ComponentsLayout } = await import("../layout");

describe("ComponentsLayout", () => {
	it("serves the gallery where it is enabled", async () => {
		deployment.env = { NODE_ENV: "development", ADMIN_COMPONENT_GALLERY: undefined };

		await expect(ComponentsLayout({ children: null })).resolves.toBeDefined();
	});

	it("answers 404 in a deployment that has not enabled it", async () => {
		deployment.env = { NODE_ENV: "production", ADMIN_COMPONENT_GALLERY: undefined };

		await expect(ComponentsLayout({ children: null })).rejects.toThrow(NOT_FOUND);
	});
});
