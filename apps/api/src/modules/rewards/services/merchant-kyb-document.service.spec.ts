import type { StoredFile } from "@prisma/client";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { storedFile } from "../../../../test/support/file-lifecycle-fakes";
import { StoredFileRepository } from "../../files/repositories/stored-file.repository";
import { FileService } from "../../files/services/file.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { MerchantKybDocumentService, kybDocumentScanStatusOf } from "./merchant-kyb-document.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const ORG_ID = "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c";
type KybStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "ACTION_REQUIRED";

interface FakeTransaction {
	readonly tx: PrismaService;
	readonly lockProfile: ReturnType<typeof vi.fn>;
	readonly updateProfile: ReturnType<typeof vi.fn>;
}

function fakeTx(kybStatus: KybStatusValue): FakeTransaction {
	const lockProfile = vi.fn().mockResolvedValue([]);
	const updateProfile = vi.fn().mockResolvedValue({});
	const tx = Object.assign(new PrismaService(createTestTypedConfig()), {
		$queryRaw: lockProfile,
		organizationMerchantProfile: { findUnique: vi.fn().mockResolvedValue({ kybStatus }), update: updateProfile },
	});
	return { tx, lockProfile, updateProfile };
}

function link(file: StoredFile): { file: StoredFile } {
	return { file };
}

describe("kybDocumentScanStatusOf", () => {
	it.each<[string, Partial<StoredFile>, string]>([
		["a pending scan", { status: "SCANNING", scanStatus: "SCANNING" }, "SCANNING"],
		["a clean READY file", { status: "READY", scanStatus: "CLEAN" }, "CLEAN"],
		["a quarantined file", { status: "QUARANTINED", scanStatus: "INFECTED" }, "INFECTED"],
		["a failed scan — never reported as infected", { status: "FAILED", scanStatus: "SCANNING" }, "SCAN_FAILED"],
	])("maps %s", (_label, overrides, expected) => {
		expect(kybDocumentScanStatusOf(storedFile(overrides))).toBe(expected);
	});
});

describe("MerchantKybDocumentService.reconcileOrgKybStatusInTx", () => {
	const repository = { listActiveOrganizationKybFiles: vi.fn(), findOwnKybUploads: vi.fn() };
	let service: MerchantKybDocumentService;

	beforeEach(async () => {
		vi.clearAllMocks();
		const moduleRef = await Test.createTestingModule({
			providers: [MerchantKybDocumentService, { provide: StoredFileRepository, useValue: repository }, { provide: FileService, useValue: {} }],
		}).compile();
		service = moduleRef.get(MerchantKybDocumentService);
	});

	it.each<[string, Partial<StoredFile>]>([
		["infected", { status: "QUARANTINED", scanStatus: "INFECTED" }],
		["unscannable", { status: "FAILED" }],
	])("moves a PENDING review to ACTION_REQUIRED when submitted evidence turns out %s", async (_label, overrides) => {
		const fake = fakeTx("PENDING");
		repository.listActiveOrganizationKybFiles.mockResolvedValue([link(storedFile({ status: "READY", scanStatus: "CLEAN" })), link(storedFile(overrides))]);

		await service.reconcileOrgKybStatusInTx(fake.tx, ORG_ID);

		expect(fake.lockProfile).toHaveBeenCalled();
		expect(fake.updateProfile.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ where: { organizationId: ORG_ID }, data: { kybStatus: "ACTION_REQUIRED" } });
	});

	it("returns an ACTION_REQUIRED review to PENDING once every document is clean", async () => {
		const fake = fakeTx("ACTION_REQUIRED");
		repository.listActiveOrganizationKybFiles.mockResolvedValue([link(storedFile({ status: "READY", scanStatus: "CLEAN" }))]);

		await service.reconcileOrgKybStatusInTx(fake.tx, ORG_ID);

		expect(fake.updateProfile.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ data: { kybStatus: "PENDING" } });
	});

	it("leaves the review alone while a document is still scanning", async () => {
		const fake = fakeTx("PENDING");
		repository.listActiveOrganizationKybFiles.mockResolvedValue([link(storedFile({ status: "SCANNING" }))]);

		await service.reconcileOrgKybStatusInTx(fake.tx, ORG_ID);

		expect(fake.updateProfile).not.toHaveBeenCalled();
	});

	it.each<KybStatusValue>(["APPROVED", "REJECTED"])("never changes a decided (%s) review", async (status) => {
		const fake = fakeTx(status);
		repository.listActiveOrganizationKybFiles.mockResolvedValue([link(storedFile({ status: "QUARANTINED", scanStatus: "INFECTED" }))]);

		await service.reconcileOrgKybStatusInTx(fake.tx, ORG_ID);

		expect(fake.updateProfile).not.toHaveBeenCalled();
	});
});

describe("MerchantKybDocumentService.describeOwnUploads", () => {
	const OTHER_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
	const repository = { listActiveOrganizationKybFiles: vi.fn(), findOwnKybUploads: vi.fn() };
	let service: MerchantKybDocumentService;

	beforeEach(async () => {
		vi.clearAllMocks();
		const moduleRef = await Test.createTestingModule({
			providers: [MerchantKybDocumentService, { provide: StoredFileRepository, useValue: repository }, { provide: FileService, useValue: {} }],
		}).compile();
		service = moduleRef.get(MerchantKybDocumentService);
	});

	it("asks only for the caller's own KYB uploads and omits every other id (no oracle)", async () => {
		const own = storedFile({ status: "FAILED" });
		repository.findOwnKybUploads.mockResolvedValue([own]);

		const records = await service.describeOwnUploads(ORG_ID, own.uploadedById, [OTHER_ID, own.id]);

		expect(repository.findOwnKybUploads).toHaveBeenCalledWith(ORG_ID, own.uploadedById, [OTHER_ID, own.id]);
		expect(records.map((record) => [record.id, record.scanStatus])).toEqual([[own.id, "SCAN_FAILED"]]);
	});
});
