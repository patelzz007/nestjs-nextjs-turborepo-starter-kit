import { describe, expect, it } from "vitest";
import type { CreateFileUploadUrlInput, FileCategory, MerchantCapability, OrganizationMembershipRole } from "@workspace/shared";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import type { FileAccessSubject, FileActor } from "../../../files/public-api";
import type { MembershipRoleLookupPort, MerchantCapabilityGatePort } from "../ports/organization-file-access.port";
import { KYB_EVIDENCE_CAPABILITIES, STORE_BRANDING_CAPABILITIES } from "../services/organization-file-capabilities";
import { OrganizationFileAccessRule } from "../services/organization-file-access.rule";

const ACTOR: FileActor = { userId: "user-1", isSuperAdmin: false };
const BASE: Pick<CreateFileUploadUrlInput, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256"> = {
	fileName: "f.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};

function file(category: FileCategory, overrides: Partial<FileAccessSubject> = {}): FileAccessSubject {
	return { id: "file-1", category, uploadedById: "user-1", organizationId: "org-1", productId: null, ...overrides };
}

/** A fixed membership role per user. */
class Memberships implements MembershipRoleLookupPort {
	public constructor(private readonly role: OrganizationMembershipRole | null) {}

	public activeRole(): Promise<OrganizationMembershipRole | null> {
		return Promise.resolve(this.role);
	}
}

/** Records the Cedar calls and can deny them; `view_locations` is the membership-only capability. */
class RecordingGate implements MerchantCapabilityGatePort {
	public readonly cedarChecks: { readonly role: OrganizationMembershipRole; readonly capability: MerchantCapability }[] = [];

	public constructor(private readonly cedarDenies = false) {}

	public isMembershipOnly(capability: MerchantCapability): boolean {
		return capability === "merchant:view_locations";
	}

	public requireMembershipCapability(subject: { readonly role: OrganizationMembershipRole }, capability: MerchantCapability): Promise<void> {
		this.cedarChecks.push({ role: subject.role, capability });
		return this.cedarDenies ? Promise.reject(new AuthorizationError({ message: "cedar denied" })) : Promise.resolve();
	}
}

function branding(role: OrganizationMembershipRole | null, gate = new RecordingGate()): OrganizationFileAccessRule {
	return new OrganizationFileAccessRule(["STORE_LOGO", "STORE_BANNER"], STORE_BRANDING_CAPABILITIES, new Memberships(role), gate);
}

describe("OrganizationFileAccessRule", () => {
	it("checks store branding against the tenant Cedar policy after the role table", async () => {
		const gate = new RecordingGate();

		await expect(branding("ADMIN", gate).assertCanUpload(ACTOR, { ...BASE, category: "STORE_LOGO", organizationId: "org-1", assetType: "LOGO" })).resolves.toBeUndefined();
		expect(gate.cedarChecks).toEqual([{ role: "ADMIN", capability: "merchant:manage_locations" }]);
	});

	it("denies non-members and requests without an organization with the action's code", async () => {
		await expect(branding(null).assertCanUpload(ACTOR, { ...BASE, category: "STORE_BANNER", organizationId: "org-1", assetType: "BANNER" })).rejects.toMatchObject({
			code: "FILE_UPLOAD_FORBIDDEN",
		});
		await expect(branding("OWNER").assertCanUpload(ACTOR, { ...BASE, category: "STORE_LOGO", assetType: "LOGO" })).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		await expect(branding("OWNER").assertCanAct(ACTOR, file("STORE_LOGO", { organizationId: null }), "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
		await expect(branding(null).assertCanAct(ACTOR, file("STORE_LOGO"), "read")).rejects.toMatchObject({ code: "FILE_VIEW_FORBIDDEN" });
	});

	it("lets any member read store branding (membership only, no Cedar action)", async () => {
		const gate = new RecordingGate();

		await expect(branding("MEMBER", gate).assertCanAct({ userId: "someone-else", isSuperAdmin: false }, file("STORE_LOGO"), "read")).resolves.toBeUndefined();
		expect(gate.cedarChecks).toEqual([]);
	});

	it("propagates the tenant Cedar denial", async () => {
		const rule = new OrganizationFileAccessRule(["MERCHANT_KYB"], KYB_EVIDENCE_CAPABILITIES, new Memberships("OWNER"), new RecordingGate(true));

		await expect(rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "read")).rejects.toThrow("cedar denied");
	});

	it("needs manage_verification for every KYB action, read included", async () => {
		const gate = new RecordingGate();
		const rule = new OrganizationFileAccessRule(["MERCHANT_KYB"], KYB_EVIDENCE_CAPABILITIES, new Memberships("OWNER"), gate);

		await rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "read");
		await rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "delete");

		expect(gate.cedarChecks.map((check) => check.capability)).toEqual(["merchant:manage_verification", "merchant:manage_verification"]);
	});

	it("decides by the CURRENT capability, never by who uploaded: a former member who uploaded cannot delete", async () => {
		await expect(branding(null).assertCanAct(ACTOR, file("STORE_BANNER", { uploadedById: ACTOR.userId }), "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
		await expect(branding("ADMIN").assertCanAct({ userId: "admin-2", isSuperAdmin: false }, file("STORE_BANNER"), "delete")).resolves.toBeUndefined();
	});

	it("uses the read capability to read and the manage capability to complete", async () => {
		const gate = new RecordingGate();
		const rule = new OrganizationFileAccessRule(
			["REWARD_IMAGE"],
			{ manage: "merchant:manage_rewards", read: "merchant:view_rewards", deniedMessage: "denied" },
			new Memberships("CASHIER"),
			gate,
		);

		await rule.assertCanAct(ACTOR, file("REWARD_IMAGE"), "read");
		await rule.assertCanAct(ACTOR, file("REWARD_IMAGE"), "complete");

		expect(gate.cedarChecks.map((check) => check.capability)).toEqual(["merchant:view_rewards", "merchant:manage_rewards"]);
	});
});
