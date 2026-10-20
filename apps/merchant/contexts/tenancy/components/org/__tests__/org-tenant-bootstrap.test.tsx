// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { OrgTenantBootstrap } from "@/contexts/tenancy/components/org/org-tenant-bootstrap";
import { TENANT_SLUG_COOKIE_NAME } from "@/contexts/tenancy/lib/org/slug";
import { TEST_ORG_SLUG } from "@/test/authorization";

function slugCookieValue(): string | undefined {
	const prefix = `${TENANT_SLUG_COOKIE_NAME}=`;
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
}

afterEach((): void => {
	cleanup();
	document.cookie = `${TENANT_SLUG_COOKIE_NAME}=; path=/; max-age=0`;
});

describe("OrgTenantBootstrap", () => {
	it("records the opened tenant as the last one, and follows a switch", () => {
		const { rerender } = render(<OrgTenantBootstrap tenantSlug={TEST_ORG_SLUG} />);
		expect(slugCookieValue()).toBe(TEST_ORG_SLUG);

		rerender(<OrgTenantBootstrap tenantSlug="bean-there" />);
		expect(slugCookieValue()).toBe("bean-there");
	});

	it("renders nothing", () => {
		const { container } = render(<OrgTenantBootstrap tenantSlug={TEST_ORG_SLUG} />);

		expect(container.innerHTML).toBe("");
	});
});
