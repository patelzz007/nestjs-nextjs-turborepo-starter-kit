import { createHash, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { JsonObjectSchema, MerchantKybLegacyDocumentSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";

import { TypedConfigService } from "../src/config/typed-config.service";
import { LocalObjectStorageService } from "../src/modules/storage/local-object-storage.service";
import { buildKybQuarantinePath } from "../src/modules/rewards/utils/kyb-storage-path.util";
import { verifyMagicBytes } from "../src/modules/storage/utils/magic-bytes.util";

const LegacyDocumentsSchema = z.array(MerchantKybLegacyDocumentSchema);

interface BackfillOptions {
	readonly dryRun: boolean;
	readonly limit: number;
}

function parseOptions(argv: readonly string[]): BackfillOptions {
	return {
		dryRun: argv.includes("--dry-run"),
		limit: Number.parseInt(argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "100", 10),
	};
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl === undefined || databaseUrl.length === 0) {
		throw new Error("DATABASE_URL is required");
	}

	const pool = new Pool({ connectionString: databaseUrl });
	const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	const storage = new LocalObjectStorageService(new TypedConfigService());
	const bucket = process.env.STORAGE_S3_BUCKET ?? "local-object-bucket";

	const orgs = await prisma.merchantOrg.findMany({
		where: { isDeleted: false, kybFields: { not: Prisma.DbNull } },
		take: options.limit,
		orderBy: { createdAt: "asc" },
	});

	let migrated = 0;
	let skipped = 0;

	for (const org of orgs) {
		const kybFields = JsonObjectSchema.safeParse(org.kybFields);
		if (!kybFields.success) {
			skipped += 1;
			continue;
		}
		const legacyDocuments = LegacyDocumentsSchema.safeParse(kybFields.data.documents);
		if (!legacyDocuments.success || legacyDocuments.data.length === 0) {
			skipped += 1;
			continue;
		}

		const existingCount = await prisma.merchantKybDocument.count({
			where: { merchantOrgId: org.id, isDeleted: false },
		});
		if (existingCount > 0) {
			skipped += 1;
			continue;
		}

		const submissionId = randomUUID();
		for (const legacy of legacyDocuments.data) {
			const buffer = Buffer.from(legacy.contentBase64, "base64");
			if (!verifyMagicBytes(buffer, legacy.mimeType)) {
				console.warn(`Skipping invalid legacy document for org ${org.id}: ${legacy.fileName}`);
				continue;
			}

			const documentId = randomUUID();
			const storagePath = buildKybQuarantinePath(org.id, submissionId, legacy.fileName);
			if (!options.dryRun) {
				await storage.upload({ bucket, path: storagePath, buffer, mimeType: legacy.mimeType });
				await prisma.merchantKybDocument.create({
					data: {
						id: documentId,
						merchantOrgId: org.id,
						submissionId,
						fileName: legacy.fileName,
						mimeType: legacy.mimeType,
						sizeBytes: legacy.sizeBytes,
						checksumSha256: createHash("sha256").update(buffer).digest("hex"),
						storageBucket: bucket,
						storagePath,
						scanStatus: "SCANNING",
						isActive: true,
					},
				});
			}
			migrated += 1;
		}

		if (!options.dryRun) {
			const nextFields = { ...kybFields.data };
			delete nextFields.documents;
			await prisma.merchantOrg.update({
				where: { id: org.id },
				data: { kybFields: nextFields },
			});
		}
	}

	console.log(JSON.stringify({ dryRun: options.dryRun, migrated, skipped, processedOrgs: orgs.length }, null, 2));
	await prisma.$disconnect();
	await pool.end();
}

void main();
