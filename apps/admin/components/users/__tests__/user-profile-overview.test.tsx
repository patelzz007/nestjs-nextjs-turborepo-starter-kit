// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminUserDetailSchema, type AdminUserDetail } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UserProfileOverview } from "../user-profile-overview";

const REFERRER_ID = "8c1b6d2e-4f3a-4b5c-9d6e-7f8a9b0c1d2e";

const USER: AdminUserDetail = AdminUserDetailSchema.parse({
	id: "user-1",
	email: "jane@example.com",
	fullName: "Jane Doe",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 1,
	roles: [],
	permissions: [],
	failedLoginAttempts: 0,
	lockedUntil: null,
	directPermissionIds: [],
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
	isDeleted: false,
	deletedAt: null,
	signupReferrer: null,
	signupReferralStatus: null,
});

/** The `<dd>` value of the field labelled `label` inside the Signup referral section. */
function signupReferralField(label: string): HTMLElement {
	const term = screen.getByText(label);
	const field = term.parentElement;
	if (field === null) {
		throw new Error(`field ${label} not rendered`);
	}
	return within(field).getByRole("definition");
}

afterEach((): void => {
	cleanup();
});

describe("UserProfileOverview signup referral section", () => {
	it("shows None for both facts when the user registered without a referral code", () => {
		render(<UserProfileOverview user={USER} />);

		expect(signupReferralField("Referrer").textContent).toBe("None");
		expect(signupReferralField("Referral status").textContent).toBe("None");
	});

	it("links the referrer to their profile and labels the status", () => {
		render(<UserProfileOverview user={{ ...USER, signupReferrer: { id: REFERRER_ID, fullName: "Alice Referrer" }, signupReferralStatus: "not_redeemed" }} />);

		expect(screen.getByRole("link", { name: "Alice Referrer" }).getAttribute("href")).toBe(`/users/${REFERRER_ID}`);
		expect(signupReferralField("Referral status").textContent).toBe("Not redeemed");
	});
});
