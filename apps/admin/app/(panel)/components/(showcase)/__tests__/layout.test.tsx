// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const NOT_FOUND = "NEXT_NOT_FOUND";

const flags = vi.hoisted((): { showcase: boolean } => ({ showcase: true }));

vi.mock("next/navigation", () => ({
	notFound: (): void => {
		throw new Error(NOT_FOUND);
	},
}));

vi.mock("@/lib/server/feature-flag-settings", () => ({
	isFeatureEnabled: (): Promise<boolean> => Promise.resolve(flags.showcase),
}));

const { default: ComponentsLayout } = await import("../layout");

describe("ComponentsLayout", () => {
	it("serves the showcase while its flag is on", async () => {
		flags.showcase = true;

		await expect(ComponentsLayout({ children: null })).resolves.toBeDefined();
	});

	it("answers 404 while the showcase flag is off", async () => {
		flags.showcase = false;

		await expect(ComponentsLayout({ children: null })).rejects.toThrow(NOT_FOUND);
	});
});
