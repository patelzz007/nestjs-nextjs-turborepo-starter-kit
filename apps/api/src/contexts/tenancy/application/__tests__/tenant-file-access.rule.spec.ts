import { describe, expect, it } from "vitest";
import type { FileUploadRequest, FileCategory, MerchantCapability, MembershipRole } from "@workspace/shared";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import type { FileAccessSubject, FileActor } from "../../../files/public-api";
import type { MembershipRoleLookupPort, MerchantCapabilityGatePort } from "../ports/tenant-file-access.port";
import { KYB_EVIDENCE_CAPABILITIES, STORE_BRANDING_CAPABILITIES } from "../services/tenant-file-capabilities";
import { TenantFileAccessRule } from "../services/tenant-file-access.rule";

const ACTOR: FileActor = { userId: "user-1", isSuperAdmin: false };
const BASE: Pick<FileUploadRequest, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256"> = {
	fileName: "f.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};

function file(category: FileCategory, overrides: Partial<FileAccessSubject> = {}): FileAccessSubject {
	return { id: "file-1", category, uploadedById: "user-1", tenantId: "org-1", productId: null, ...overrides };
}

/** A fixed membership role per user. */
class Memberships implements MembershipRoleLookupPort {
	public constructor(private readonly role: MembershipRole | null) {}

	public activeRole(): Promise<MembershipRole | null> {
		return Promise.resolve(this.role);
	}
}

/** Records the capability checks (the member's role and grants decide them, ADR 067) and can deny them. */
class RecordingGate implements MerchantCapabilityGatePort {
	public readonly checks: { readonly role: MembershipRole; readonly capability: MerchantCapability }[] = [];

	public constructor(private readonly denies = false) {}

	public requireMembershipCapability(subject: { readonly role: MembershipRole }, capability: MerchantCapability): Promise<void> {
		this.checks.push({ role: subject.role, capability });
		return this.denies ? Promise.reject(new AuthorizationError({ message: "capability denied" })) : Promise.resolve();
	}
}

function branding(role: MembershipRole | null, gate = new RecordingGate()): TenantFileAccessRule {
	return new TenantFileAccessRule(["STORE_LOGO", "STORE_BANNER"], STORE_BRANDING_CAPABILITIES, new Memberships(role), gate);
}

describe("TenantFileAccessRule", () => {
	it("checks store branding uploads against the manage capability", async () => {
		const gate = new RecordingGate();

		await expect(branding("MANAGER", gate).assertCanUpload(ACTOR, { ...BASE, category: "STORE_LOGO", tenantId: "org-1", assetType: "LOGO" })).resolves.toBeUndefined();
		expect(gate.checks).toEqual([{ role: "MANAGER", capability: "merchant:manage_locations" }]);
	});

	it("denies non-members and requests without a tenant with the action's code", async () => {
		await expect(branding(null).assertCanUpload(ACTOR, { ...BASE, category: "STORE_BANNER", tenantId: "org-1", assetType: "BANNER" })).rejects.toMatchObject({
			code: "FILE_UPLOAD_FORBIDDEN",
		});
		await expect(branding("OWNER").assertCanUpload(ACTOR, { ...BASE, category: "STORE_LOGO", assetType: "LOGO" })).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		await expect(branding("OWNER").assertCanAct(ACTOR, file("STORE_LOGO", { tenantId: null }), "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
		await expect(branding(null).assertCanAct(ACTOR, file("STORE_LOGO"), "read")).rejects.toMatchObject({ code: "FILE_VIEW_FORBIDDEN" });
	});

	it("reads store branding with the view capability, like every other capability check", async () => {
		const gate = new RecordingGate();

		await expect(branding("CASHIER", gate).assertCanAct({ userId: "someone-else", isSuperAdmin: false }, file("STORE_LOGO"), "read")).resolves.toBeUndefined();
		expect(gate.checks).toEqual([{ role: "CASHIER", capability: "merchant:view_locations" }]);
	});

	it("propagates the capability denial", async () => {
		const rule = new TenantFileAccessRule(["MERCHANT_KYB"], KYB_EVIDENCE_CAPABILITIES, new Memberships("OWNER"), new RecordingGate(true));

		await expect(rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "read")).rejects.toThrow("capability denied");
	});

	it("needs manage_verification for every KYB action, read included", async () => {
		const gate = new RecordingGate();
		const rule = new TenantFileAccessRule(["MERCHANT_KYB"], KYB_EVIDENCE_CAPABILITIES, new Memberships("OWNER"), gate);

		await rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "read");
		await rule.assertCanAct(ACTOR, file("MERCHANT_KYB"), "delete");

		expect(gate.checks.map((check) => check.capability)).toEqual(["merchant:manage_verification", "merchant:manage_verification"]);
	});

	it("decides by the CURRENT capability, never by who uploaded: a former member who uploaded cannot delete", async () => {
		await expect(branding(null).assertCanAct(ACTOR, file("STORE_BANNER", { uploadedById: ACTOR.userId }), "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
		await expect(branding("MANAGER").assertCanAct({ userId: "manager-2", isSuperAdmin: false }, file("STORE_BANNER"), "delete")).resolves.toBeUndefined();
	});

	it("uses the read capability to read and the manage capability to complete", async () => {
		const gate = new RecordingGate();
		const rule = new TenantFileAccessRule(
			["REWARD_IMAGE"],
			{ manage: "merchant:manage_rewards", read: "merchant:view_rewards", deniedMessage: "denied" },
			new Memberships("CASHIER"),
			gate,
		);

		await rule.assertCanAct(ACTOR, file("REWARD_IMAGE"), "read");
		await rule.assertCanAct(ACTOR, file("REWARD_IMAGE"), "complete");

		expect(gate.checks.map((check) => check.capability)).toEqual(["merchant:view_rewards", "merchant:manage_rewards"]);
	});
});
