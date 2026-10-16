// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { OrgTenantBootstrap } from "@/components/org/org-tenant-bootstrap";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";
import { TEST_ORG_SLUG } from "@/test/authorization";

function slugCookieValue(): string | undefined {
	const prefix = `${ORGANIZATION_SLUG_COOKIE_NAME}=`;
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
}

afterEach((): void => {
	cleanup();
	document.cookie = `${ORGANIZATION_SLUG_COOKIE_NAME}=; path=/; max-age=0`;
});

describe("OrgTenantBootstrap", () => {
	it("records the opened organization as the last one, and follows a switch", () => {
		const { rerender } = render(<OrgTenantBootstrap orgSlug={TEST_ORG_SLUG} />);
		expect(slugCookieValue()).toBe(TEST_ORG_SLUG);

		rerender(<OrgTenantBootstrap orgSlug="bean-there" />);
		expect(slugCookieValue()).toBe("bean-there");
	});

	it("renders nothing", () => {
		const { container } = render(<OrgTenantBootstrap orgSlug={TEST_ORG_SLUG} />);

		expect(container.innerHTML).toBe("");
	});
});
