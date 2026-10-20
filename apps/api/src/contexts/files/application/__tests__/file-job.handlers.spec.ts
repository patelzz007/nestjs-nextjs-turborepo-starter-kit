import type { FileProcessingResult, StorageCdnInvalidationJob } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { ApplyFileProcessingResultCommand } from "../commands/apply-file-processing-result/apply-file-processing-result.command";
import { ApplyFileProcessingResultHandler } from "../commands/apply-file-processing-result/apply-file-processing-result.handler";
import { InvalidateFileCdnCommand } from "../commands/invalidate-file-cdn/invalidate-file-cdn.command";
import { InvalidateFileCdnHandler } from "../commands/invalidate-file-cdn/invalidate-file-cdn.handler";
import { PurgeFileObjectCommand } from "../commands/purge-file-object/purge-file-object.command";
import { PurgeFileObjectHandler } from "../commands/purge-file-object/purge-file-object.handler";
import { ScanFileCommand } from "../commands/scan-file/scan-file.command";
import { ScanFileHandler } from "../commands/scan-file/scan-file.handler";
import type { CdnInvalidationPort, FileProcessingPort, ProcessingCallbackAuthenticator, VerdictOutcome } from "../ports/file-processing.port";
import { FILE_ID, FakeFileObjectStorage } from "./fakes/files.fakes";

const SCAN_ACTOR: ActorContext = systemActor("files.scan_verdict.apply", "job", null, "scan", null);

/** Records the pipeline calls and answers with a fixed outcome. */
class RecordingProcessing implements FileProcessingPort {
	public readonly scans: { readonly actor: ActorContext; readonly fileId: string; readonly finalAttempt: boolean }[] = [];
	public readonly results: FileProcessingResult[] = [];

	public scan(actor: ActorContext, fileId: string, finalAttempt: boolean): Promise<VerdictOutcome> {
		this.scans.push({ actor, fileId, finalAttempt });
		return Promise.resolve("READY");
	}

	public applyProcessingResult(_actor: ActorContext, result: FileProcessingResult): Promise<void> {
		this.results.push(result);
		return Promise.resolve();
	}
}

/** Fails the first `failures` calls (a CloudFront outage), then succeeds. */
class FlakyCdn implements CdnInvalidationPort {
	public readonly jobs: StorageCdnInvalidationJob[] = [];

	public constructor(private failures: number) {}

	public invalidate(job: StorageCdnInvalidationJob): Promise<void> {
		this.jobs.push(job);
		if (this.failures > 0) {
			this.failures -= 1;
			return Promise.reject(new Error("CloudFront unavailable"));
		}
		return Promise.resolve();
	}
}

/** Accepts exactly one secret. */
class SecretAuthenticator implements ProcessingCallbackAuthenticator {
	public assertAuthentic(presented: string | null): void {
		if (presented !== "s3cret") {
			throw new AuthenticationError({ code: "CALLBACK_UNAUTHORIZED", message: "Invalid processing callback secret" });
		}
	}
}

describe("ScanFileHandler", () => {
	it("hands the job's actor, file and final-attempt flag to the pipeline", async () => {
		const processing = new RecordingProcessing();

		await expect(new ScanFileHandler(processing).execute(new ScanFileCommand(SCAN_ACTOR, FILE_ID, true))).resolves.toBe("READY");
		expect(processing.scans).toEqual([{ actor: SCAN_ACTOR, fileId: FILE_ID, finalAttempt: true }]);
	});
});

describe("ApplyFileProcessingResultHandler", () => {
	const result: FileProcessingResult = { fileId: FILE_ID, status: "QUARANTINED" };

	it("authenticates the worker's secret before applying anything", async () => {
		const processing = new RecordingProcessing();
		const handler = new ApplyFileProcessingResultHandler(new SecretAuthenticator(), processing);

		await expect(handler.execute(new ApplyFileProcessingResultCommand(SCAN_ACTOR, null, result))).rejects.toMatchObject({ code: "CALLBACK_UNAUTHORIZED" });
		await expect(handler.execute(new ApplyFileProcessingResultCommand(SCAN_ACTOR, "wrong", result))).rejects.toMatchObject({ code: "CALLBACK_UNAUTHORIZED" });
		expect(processing.results).toEqual([]);

		await handler.execute(new ApplyFileProcessingResultCommand(SCAN_ACTOR, "s3cret", result));
		expect(processing.results).toEqual([result]);
	});
});

describe("PurgeFileObjectHandler", () => {
	it("deletes exactly the stored copy the job names", async () => {
		const storage = new FakeFileObjectStorage();

		await new PurgeFileObjectHandler(storage).execute(new PurgeFileObjectCommand(SCAN_ACTOR, { fileId: FILE_ID, provider: "local", container: "c", path: "a/b.png" }));

		expect(storage.deleted).toEqual(["a/b.png"]);
	});
});

describe("InvalidateFileCdnHandler", () => {
	const job: StorageCdnInvalidationJob = { fileId: FILE_ID, objectKeys: ["products/p/original/f.png"] };

	it("fails the attempt when the CDN rejects the purge (so BullMQ retries) and succeeds on the retry with the same job", async () => {
		const cdn = new FlakyCdn(1);
		const handler = new InvalidateFileCdnHandler(cdn);

		await expect(handler.execute(new InvalidateFileCdnCommand(SCAN_ACTOR, job))).rejects.toThrow("CloudFront unavailable");
		await expect(handler.execute(new InvalidateFileCdnCommand(SCAN_ACTOR, job))).resolves.toBeUndefined();
		expect(cdn.jobs).toEqual([job, job]);
	});

	it("rejects a job without keys", async () => {
		await expect(new InvalidateFileCdnHandler(new FlakyCdn(0)).execute(new InvalidateFileCdnCommand(SCAN_ACTOR, { fileId: FILE_ID, objectKeys: [] }))).rejects.toThrow();
	});
});
