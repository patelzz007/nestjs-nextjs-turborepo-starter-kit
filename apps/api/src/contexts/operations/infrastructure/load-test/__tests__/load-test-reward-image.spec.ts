import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getFileCategoryPolicy, ImageRulesSchema, type StorageObjectLocator } from "@workspace/shared";

import { InMemoryObjectStorage, imageRenditionsFor } from "../../../../../../e2e/support/file-lifecycle-fakes";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import { SharpImageProcessor } from "../../../../../platform/infrastructure/storage/adapters/images/sharp-image-processor";
import type { ServerFileIngest, ServerFileIngestRequest } from "../../../../files/public-api";
import { superAdminActor } from "../../../application/__tests__/fakes/operations.fakes";
import { LOAD_TEST_REWARD_IMAGE_LABEL, LOAD_TEST_REWARD_IMAGE_NAME, LoadTestRewardImage, renderLoadTestRewardPicture } from "../load-test-reward-image";

const TENANT_ID = "019a0000-0000-7000-8000-000000000001";
const OPERATOR_ID = "019a0000-0000-7000-8000-000000000004";
const FILE_ID = "019a0000-0000-7000-8000-000000000003";
const LOCATOR: StorageObjectLocator = { provider: "local", container: "private", path: "staging/load-test-reward.png", revision: null };

/** The files context's ingest, recording what it was handed. */
class RecordingIngest implements Pick<ServerFileIngest, "ingest"> {
	public readonly requests: { readonly actor: ActorContext; readonly request: ServerFileIngestRequest }[] = [];

	public ingest(actor: ActorContext, request: ServerFileIngestRequest): Promise<string> {
		this.requests.push({ actor, request });
		return Promise.resolve(FILE_ID);
	}
}

describe("renderLoadTestRewardPicture", () => {
	it("is a PNG at the smallest size the REWARD_IMAGE pixel rules accept, which the rendition service's own check passes", async () => {
		const picture = await renderLoadTestRewardPicture();
		const rules = ImageRulesSchema.parse(getFileCategoryPolicy("REWARD_IMAGE").imageRules);

		const metadata = await sharp(picture).metadata();
		expect(metadata.format).toBe("png");
		expect({ width: metadata.width, height: metadata.height }).toEqual({ width: rules.minWidth, height: rules.minHeight });
		const storage = new InMemoryObjectStorage();
		storage.put(LOCATOR, picture);
		await expect(imageRenditionsFor(storage, new SharpImageProcessor()).inspectUpload({ category: "REWARD_IMAGE" }, LOCATOR)).resolves.toEqual({
			width: rules.minWidth,
			height: rules.minHeight,
		});
	});

	it("says in its EXIF that it is a load-test picture", async () => {
		const { exif } = await sharp(await renderLoadTestRewardPicture()).metadata();

		expect(exif?.toString("latin1")).toContain(LOAD_TEST_REWARD_IMAGE_LABEL);
	});

	it("is the same bytes every time, so a later run's ingest finds the stored picture", async () => {
		expect((await renderLoadTestRewardPicture()).equals(await renderLoadTestRewardPicture())).toBe(true);
	});
});

describe("LoadTestRewardImage.ensure", () => {
	it("ingests the picture as a REWARD_IMAGE of the Load Test tenant uploaded by the operator, and returns the READY file", async () => {
		const ingest = new RecordingIngest();
		const actor = superAdminActor(OPERATOR_ID);

		await expect(new LoadTestRewardImage(ingest).ensure(actor, TENANT_ID, OPERATOR_ID)).resolves.toBe(FILE_ID);

		const picture = await renderLoadTestRewardPicture();
		expect(ingest.requests).toEqual([
			{
				actor,
				request: {
					upload: { category: "REWARD_IMAGE", tenantId: TENANT_ID, fileName: LOAD_TEST_REWARD_IMAGE_NAME, mimeType: "image/png" },
					uploadedById: OPERATOR_ID,
					bytes: picture,
				},
			},
		]);
	});
});
