import { FILE_CATEGORY_POLICIES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { FileDeleted } from "../../domain/events/file-deleted.event";
import { CleanUpStaleUploadsCommand } from "../commands/clean-up-stale-uploads/clean-up-stale-uploads.command";
import { CleanUpStaleUploadsHandler } from "../commands/clean-up-stale-uploads/clean-up-stale-uploads.handler";
import { FileDeletion } from "../commands/delete-file/file-deletion";
import type { FilesScope } from "../files-scope";
import { FileReferenceGuardRegistry } from "../ports/file-reference.port";
import { STORAGE_CLEANUP_ACTOR } from "../ports/files.tokens";
import {
	FILE_ID,
	InMemoryStoredFileReads,
	InMemoryStoredFiles,
	NOW,
	OTHER_FILE_ID,
	RecordingStorageTaskDispatcher,
	cleanupActor,
	filesScope,
	storedFileState,
	viewOf,
} from "./fakes/files.fakes";

interface Fixture {
	readonly handler: CleanUpStaleUploadsHandler;
	readonly files: InMemoryStoredFiles;
	readonly reads: InMemoryStoredFileReads;
	readonly scope: FilesScope;
	readonly dispatcher: RecordingStorageTaskDispatcher;
}

function setup(...states: ReturnType<typeof storedFileState>[]): Fixture {
	const files = new InMemoryStoredFiles(...states);
	const reads = new InMemoryStoredFileReads(files);
	const scope = filesScope(files);
	const uow = new InMemoryUnitOfWork(scope);
	const dispatcher = new RecordingStorageTaskDispatcher();
	const clock = new FixedClock(NOW);
	return {
		handler: new CleanUpStaleUploadsHandler(uow, reads, new FileDeletion(uow, new FileReferenceGuardRegistry(), clock), dispatcher, clock),
		files,
		reads,
		scope,
		dispatcher,
	};
}

describe("CleanUpStaleUploadsHandler", () => {
	it("deletes an abandoned PENDING upload through the ordinary FileDeleted path (its bytes go with the delayed purge)", async () => {
		const fixture = setup(storedFileState());
		fixture.reads.stalePending = [viewOf(storedFileState())];

		const summary = await fixture.handler.execute(new CleanUpStaleUploadsCommand(cleanupActor()));

		expect(summary).toEqual({ abandonedDeleted: 1, expiredStagingDeleted: 0, scansRedispatched: 0, failures: 0 });
		expect(fixture.files.deletedBy).toEqual([STORAGE_CLEANUP_ACTOR]);
		expect(fixture.scope.events.take().at(0)).toBeInstanceOf(FileDeleted);
	});

	it("leaves an upload whose completion won the race (no longer PENDING)", async () => {
		const fixture = setup(storedFileState({ status: "SCANNING" }));
		fixture.reads.stalePending = [viewOf(storedFileState())];

		await expect(fixture.handler.execute(new CleanUpStaleUploadsCommand(cleanupActor()))).resolves.toMatchObject({ abandonedDeleted: 0, failures: 0 });
		expect(fixture.files.status(FILE_ID)).toBe("SCANNING");
	});

	it("deletes READY staging copies nothing consumed within their category's retention (a comment picture never posted)", async () => {
		const first = storedFileState({ status: "READY", category: "GITHUB_COMMENT_IMAGE", tenantId: null });
		const second = storedFileState({ id: OTHER_FILE_ID, status: "READY", category: "GITHUB_COMMENT_IMAGE", tenantId: null });
		const fixture = setup(first, second);
		fixture.reads.expiredStaging.set("GITHUB_COMMENT_IMAGE", [viewOf(first), viewOf(second)]);

		const summary = await fixture.handler.execute(new CleanUpStaleUploadsCommand(cleanupActor()));

		expect(FILE_CATEGORY_POLICIES.GITHUB_COMMENT_IMAGE.stagingRetentionMs).toBeDefined();
		expect(summary.expiredStagingDeleted).toBe(2);
		expect(fixture.files.deletedBy).toEqual([STORAGE_CLEANUP_ACTOR, STORAGE_CLEANUP_ACTOR]);
	});

	it("keeps going past a file it cannot clean — the next sweep tries it again", async () => {
		const fixture = setup(storedFileState({ status: "SCANNING" }), storedFileState({ id: OTHER_FILE_ID, status: "SCANNING" }));
		fixture.reads.staleAwaitingVerdict = [viewOf(storedFileState({ status: "SCANNING" })), viewOf(storedFileState({ id: OTHER_FILE_ID, status: "SCANNING" }))];
		fixture.dispatcher.failRedispatchFor = FILE_ID;

		const summary = await fixture.handler.execute(new CleanUpStaleUploadsCommand(cleanupActor()));

		expect(summary).toEqual({ abandonedDeleted: 0, expiredStagingDeleted: 0, scansRedispatched: 1, failures: 1 });
		expect(fixture.dispatcher.redispatched).toEqual([OTHER_FILE_ID]);
	});
});
