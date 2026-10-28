// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TENANT_PERMISSIONS, type PermissionPair } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessExpiry, PermissionChecklist, PermissionSummary, TeamBackLink } from "@/contexts/tenancy/components/access/access-parts";
import { shareLevelLabel } from "@/contexts/tenancy/components/access/record-shares-card";
import { grantStoreLabel } from "@/contexts/tenancy/components/access/team-member-access-page-view";
import { roleCountsLabel, roleOriginLabel } from "@/contexts/tenancy/components/access/team-roles-page-view";
import { isRoleInUseError } from "@/contexts/tenancy/components/access/team-role-detail-page-view";
import { ApiError } from "@workspace/client/lib/api/use-api";

afterEach((): void => {
	cleanup();
});

const READ_REWARD: PermissionPair = { action: "READ", resource: "REWARD" };

function isKyb(permission: PermissionPair): boolean {
	return permission.resource === "KYB";
}

describe("TeamBackLink", () => {
	it("leads back to Team & permissions, on the Roles tab from a role", () => {
		const { rerender } = render(<TeamBackLink tenantSlug="acme" />);
		expect(screen.getByRole("link").getAttribute("href")).toBe("/t/acme/settings/team");

		rerender(<TeamBackLink tenantSlug="acme" tab="roles" />);
		expect(screen.getByRole("link").getAttribute("href")).toBe("/t/acme/settings/team?tab=roles");
	});
});

describe("AccessExpiry", () => {
	it("says Permanent without an end, and when it ends otherwise", () => {
		const { rerender } = render(<AccessExpiry expiresAt={null} timeZone="UTC" />);
		expect(screen.getByText("Permanent")).toBeTruthy();

		rerender(<AccessExpiry expiresAt={Date.UTC(2030, 0, 1)} timeZone="UTC" />);
		expect(screen.getByText(/Ends/)).toBeTruthy();
		expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2030-01-01T00:00:00.000Z");
	});
});

describe("PermissionChecklist", () => {
	it("offers every tenant permission as a labelled checkbox, grouped, and reports toggles", () => {
		const onToggle = vi.fn();
		render(<PermissionChecklist idPrefix="t" selected={[READ_REWARD]} onToggle={onToggle} />);

		expect(screen.getAllByRole("checkbox")).toHaveLength(TENANT_PERMISSIONS.length);
		expect(screen.getByRole("group", { name: "Rewards" })).toBeTruthy();
		fireEvent.click(document.getElementById("t-REWARD.UPDATE") ?? document.body);
		expect(onToggle).toHaveBeenCalledWith({ action: "UPDATE", resource: "REWARD" }, true);
	});

	it("locks what the caller may not give: clicking it reports nothing", () => {
		const onToggle = vi.fn();
		render(<PermissionChecklist idPrefix="l" selected={[]} onToggle={onToggle} isLocked={isKyb} />);

		fireEvent.click(document.getElementById("l-KYB.UPDATE") ?? document.body);
		expect(onToggle).not.toHaveBeenCalled();
		fireEvent.click(document.getElementById("l-REWARD.READ") ?? document.body);
		expect(onToggle).toHaveBeenCalledWith(READ_REWARD, true);
	});
});

describe("PermissionSummary", () => {
	it("lists a role's permissions by subject, and says so when there are none", () => {
		const { rerender } = render(<PermissionSummary permissions={[READ_REWARD, { action: "UPDATE", resource: "REWARD" }]} />);
		expect(screen.getByText("Rewards")).toBeTruthy();
		expect(screen.getByText("View, Edit")).toBeTruthy();

		rerender(<PermissionSummary permissions={[]} />);
		expect(screen.getByText("This role gives no permissions yet.")).toBeTruthy();
	});
});

describe("access labels", () => {
	it("describes a role's origin and counts", () => {
		expect(roleOriginLabel({ templateKey: "MANAGER" })).toBe("Standard role");
		expect(roleOriginLabel({ templateKey: null })).toBe("Created by your team");
		expect(roleCountsLabel({ permissions: [READ_REWARD], holderCount: 1 })).toBe("1 permission · 1 member");
		expect(roleCountsLabel({ permissions: [], holderCount: 3 })).toBe("0 permissions · 3 members");
	});

	it("names a grant's store and a share's level", () => {
		const stores = [{ id: "s1", name: "Bukit Beruang" }];
		expect(grantStoreLabel(null, stores)).toBe("Every store");
		expect(grantStoreLabel("s1", stores)).toBe("Bukit Beruang");
		expect(grantStoreLabel("gone", stores)).toBe("A closed store");
		expect(shareLevelLabel("EDIT")).toBe("Can edit");
		expect(shareLevelLabel("VIEW")).toBe("Can view");
	});

	it("recognises the API's refusal to delete a role members hold", () => {
		expect(isRoleInUseError(new ApiError({ error: "CONFLICT", message: "in use", statusCode: 409 }))).toBe(true);
		expect(isRoleInUseError(new ApiError({ error: "FORBIDDEN", message: "no", statusCode: 403 }))).toBe(false);
		expect(isRoleInUseError(new Error("network"))).toBe(false);
		expect(isRoleInUseError(null)).toBe(false);
	});
});
