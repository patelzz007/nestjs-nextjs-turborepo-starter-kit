// A store's broadcast picture (enhancement 5.4): one READY, public `BROADCAST_IMAGE` of Brew & Bean KL, written
// through the same checks and renditions as an upload, and shown by the seeded draft broadcast.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TENANT_SEED_IDS } from "./tenants";
import { deterministicUuid } from "./deterministic-uuid";
import { createSeedFileWriter } from "./stored-file-seed-writer";

/** The seeded picture's file id (the draft broadcast's body names it). */
export const BROADCAST_SEED_IMAGE_ID: string = deterministicUuid("broadcast-images", "kl:thank-you");
const PICTURE = join(dirname(fileURLToPath(import.meta.url)), "assets", "reward-images", "cake", "01.webp");
const UPLOADED_DAYS_AGO = 1;

export async function seedBroadcastImage(klOwnerUserId: string): Promise<string> {
	const { seedReadyFile } = createSeedFileWriter();
	await seedReadyFile({
		id: BROADCAST_SEED_IMAGE_ID,
		category: "BROADCAST_IMAGE",
		ownerId: TENANT_SEED_IDS.klTenant,
		fileName: "thank-you-cake.webp",
		mimeType: "image/webp",
		bytes: await readFile(PICTURE),
		uploadedById: klOwnerUserId,
		tenantId: TENANT_SEED_IDS.klTenant,
		uploadedDaysAgo: UPLOADED_DAYS_AGO,
	});
	return BROADCAST_SEED_IMAGE_ID;
}
