import { describe, expect, it } from "vitest";

import { LEGACY_TENANT_REDIRECTS } from "../legacy-tenant-redirects";

/** Applies the rules the way Next.js matches them: `:name` is one segment, `:path*` zero or more. */
function redirectOf(pathname: string): { readonly destination: string; readonly permanent: boolean } | null {
	for (const rule of LEGACY_TENANT_REDIRECTS) {
		const pattern = new RegExp(`^${rule.source.replace(":tenantSlug", "(?<tenantSlug>[^/]+)").replace("/:path*", "(?:/(?<path>.*))?")}$`, "u");
		const match = pattern.exec(pathname);
		if (match?.groups !== undefined) {
			const { tenantSlug = "", path = "" } = match.groups;
			const destination = rule.destination.replace(":tenantSlug", tenantSlug).replace("/:path*", path.length > 0 ? `/${path}` : "");
			return { destination, permanent: rule.permanent };
		}
	}
	return null;
}

describe("legacy /orgs redirects (MT-07)", () => {
	it("redirects an old tenant URL, and every page below it, permanently to /t/<slug>", () => {
		expect(redirectOf("/orgs/brew-bean-kl")).toEqual({ destination: "/t/brew-bean-kl", permanent: true });
		expect(redirectOf("/orgs/brew-bean-kl/rewards")).toEqual({ destination: "/t/brew-bean-kl/rewards", permanent: true });
		expect(redirectOf("/orgs/brew-bean-kl/settings/api-keys")).toEqual({ destination: "/t/brew-bean-kl/settings/api-keys", permanent: true });
	});

	it("leaves every other path alone", () => {
		expect(redirectOf("/t/brew-bean-kl/rewards")).toBeNull();
		expect(redirectOf("/orgs")).toBeNull();
		expect(redirectOf("/onboarding")).toBeNull();
	});
});
