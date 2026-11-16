import { describe, expect, it } from "vitest";

import { frontendContextBoundaryConfigs, frontendImportBoundaryConfig, mobileContextBoundaryConfigs, mobileImportBoundaryConfig } from "../import-boundaries.js";
import { isolatedConfig, ruleMessagesFor } from "../testing.js";

/** The import-boundary messages for `code` as `filePath` with ONLY the given boundary blocks. */
function messages(overrides, code, filePath) {
	return ruleMessagesFor(isolatedConfig({ overrides }), code, filePath, "workspace/restricted-imports");
}

describe("frontend context boundaries (§12.2)", () => {
	const configs = [frontendImportBoundaryConfig, ...frontendContextBoundaryConfigs];
	const file = "apps/web/contexts/rewards/components/card.tsx";

	it("rejects another context's internals, in the same app and through a package", () => {
		expect(messages(configs, 'import { ClaimCard } from "@/contexts/claims/components/card";', file).length).toBeGreaterThan(0);
		expect(messages(configs, 'import { LoginForm } from "@workspace/client/lib/contexts/identity/forms/login-form";', file).length).toBeGreaterThan(0);
		expect(messages(configs, 'import { ClaimCard } from "../../../claims/components/card";', "apps/web/contexts/rewards/components/nested/card.tsx").length).toBeGreaterThan(
			0,
		);
		expect(
			messages(configs, 'import { ClaimCard } from "../../../contexts/claims/components/card";', "packages/client/src/lib/contexts/rewards/card.tsx").length,
		).toBeGreaterThan(0);
	});

	it("still applies the browser-safety patterns inside a context", () => {
		expect(messages(configs, 'import { AppModule } from "@workspace/api";', file).length).toBeGreaterThan(0);
	});

	it("allows another context's public index", () => {
		expect(messages(configs, 'import { ClaimCard } from "@/contexts/claims";', file)).toEqual([]);
		expect(messages(configs, 'import { ClaimCard } from "@/contexts/claims/index";', file)).toEqual([]);
		expect(messages(configs, 'import { ClaimCard } from "../../claims";', file)).toEqual([]);
		expect(messages(configs, 'import { AuthProvider } from "@workspace/client/lib/contexts/identity";', file)).toEqual([]);
	});

	it("allows a context's own files", () => {
		expect(messages(configs, 'import { RewardBadge } from "@/contexts/rewards/components/badge";', file)).toEqual([]);
		expect(messages(configs, 'import { RewardBadge } from "./badge";', file)).toEqual([]);
	});

	it("allows routes, feature stores and generic code to import any context file", () => {
		expect(messages(configs, 'import { LoginForm } from "@workspace/client/lib/contexts/identity/forms/login-form";', "apps/web/app/auth/login/page.tsx")).toEqual([]);
		expect(messages(configs, 'import { sync } from "../../contexts/identity/session/sync";', "packages/client/src/lib/features/auth/actions.ts")).toEqual([]);
	});
});

describe("frontend router import", () => {
	const configs = [frontendImportBoundaryConfig, ...frontendContextBoundaryConfigs];

	it("rejects the bare App Router useRouter, in and outside a context", () => {
		const bare = 'import { useRouter } from "next/navigation";';
		expect(messages(configs, bare, "apps/admin/components/layout/command-palette.tsx").length).toBeGreaterThan(0);
		expect(messages(configs, bare, "apps/web/contexts/rewards/components/detail/claim-flow.tsx").length).toBeGreaterThan(0);
		expect(messages(configs, 'import { usePathname, useRouter } from "next/navigation";', "packages/client/src/lib/i18n/app-language-provider.tsx").length).toBeGreaterThan(0);
	});

	it("allows the rest of next/navigation and the progress router", () => {
		const file = "apps/admin/components/layout/command-palette.tsx";
		expect(messages(configs, 'import { usePathname, useSearchParams } from "next/navigation";', file)).toEqual([]);
		expect(messages(configs, 'import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";', file)).toEqual([]);
	});
});

describe("mobile import boundaries", () => {
	const configs = [mobileImportBoundaryConfig, ...mobileContextBoundaryConfigs];

	it("rejects the Nest API package", () => {
		expect(messages(configs, 'import { AppModule } from "@workspace/api";', "apps/mobile/src/app/index.tsx").length).toBeGreaterThan(0);
	});

	it("rejects another context's internals but keeps the mobile patterns inside a context", () => {
		const file = "apps/mobile/src/contexts/pos/screens/scan.tsx";
		expect(messages(configs, 'import { useSession } from "@/contexts/identity/hooks/use-session";', file).length).toBeGreaterThan(0);
		expect(messages(configs, 'import { useSession } from "@/contexts/identity";', file)).toEqual([]);
		expect(messages(configs, 'import { Button } from "@workspace/ui/components/button";', file).length).toBeGreaterThan(0);
	});
});
