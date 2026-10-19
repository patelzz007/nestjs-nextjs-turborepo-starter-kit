import { describe, expect, it } from "vitest";

import { FILE_ID, storedFile } from "../../../../../../test/support/file-lifecycle-fakes";
import { CorruptStoredFileStateError } from "../../../domain/errors/files.errors";
import { storedLocatorOf, toStoredFileAggregate, toStoredFileView } from "../stored-file.mapper";

describe("stored-file mapper", () => {
	it("reads the neutral location columns first, then the legacy bucket", () => {
		expect(
			storedLocatorOf(storedFile({ storageProvider: null, storageContainer: null, storageBucket: "local-legacy", objectRevision: null, objectGeneration: "gen-1" })),
		).toEqual({
			provider: "local",
			container: "local-legacy",
			path: storedFile().storagePath,
			revision: "gen-1",
		});
	});

	it("rejects a corrupt row instead of loading it (§spec-7.3)", () => {
		expect(() => toStoredFileAggregate(storedFile({ status: "DELETED", isDeleted: false }))).toThrow(CorruptStoredFileStateError);
	});

	it("maps the public record with its public URL resolved against the API address", () => {
		expect(toStoredFileView(storedFile({ publicPath: "/api/v1/files/x/local-public" }), "https://api.test").record).toMatchObject({
			id: FILE_ID,
			publicUrl: "https://api.test/api/v1/files/x/local-public",
		});
	});
});
