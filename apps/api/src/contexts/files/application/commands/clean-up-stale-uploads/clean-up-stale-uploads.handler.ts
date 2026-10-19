import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { FILE_CATEGORY_POLICIES, type FileCategoryPolicy } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { FilesScope } from "../../files-scope";
import { FILES_UNIT_OF_WORK, STORAGE_CLEANUP_ACTOR, STORED_FILE_READS } from "../../ports/files.tokens";
import type { StoredFileReadPort, StoredFileView } from "../../ports/stored-file-read.port";
import { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";
import { FileDeletion } from "../delete-file/file-deletion";
import { CleanUpStaleUploadsCommand, type StaleUploadSweepSummary } from "./clean-up-stale-uploads.command";

const MS_PER_MINUTE = 60_000;
/** An upload ticket lives minutes; a PENDING row this old (one hour) was abandoned. */
export const STALE_PENDING_MAX_AGE_MS = 60 * MS_PER_MINUTE;
/** A scan with no verdict after 30 minutes lost its job (or outlived its retries) and is re-dispatched. */
export const STALE_SCANNING_MAX_AGE_MS = 30 * MS_PER_MINUTE;

/**
 * One sweep: deletes abandoned PENDING uploads (a completion racing the sweep
 * wins — the delete is a compare-and-set on PENDING), deletes READY staging
 * copies nothing consumed within their category's `stagingRetentionMs` (a
 * picture for a GitHub comment that was never posted), and re-dispatches scans
 * whose verdict is overdue. Every deletion is the ordinary one (`FileDeleted`,
 * so the bytes go through the same delayed physical delete). One file's failure
 * is logged and left for the next sweep (its row is unchanged, so it is picked
 * up again) — it never aborts the batch.
 */
@CommandHandler(CleanUpStaleUploadsCommand)
export class CleanUpStaleUploadsHandler implements ICommandHandler<CleanUpStaleUploadsCommand, StaleUploadSweepSummary> {
	private readonly logger: Logger = new Logger(CleanUpStaleUploadsHandler.name);

	public constructor(
		@Inject(FILES_UNIT_OF_WORK) private readonly uow: UnitOfWork<FilesScope>,
		@Inject(STORED_FILE_READS) private readonly reads: StoredFileReadPort,
		private readonly deletion: FileDeletion,
		private readonly dispatcher: StorageTaskDispatcher,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CleanUpStaleUploadsCommand): Promise<StaleUploadSweepSummary> {
		const { actor } = command;
		const abandoned = await this.each(await this.reads.listStalePending(actor, STALE_PENDING_MAX_AGE_MS), "stale pending", (file) => this.deleteAbandoned(actor, file));
		let expired: SweepTally = { done: 0, failed: 0 };
		for (const policy of Object.values(FILE_CATEGORY_POLICIES)) {
			expired = add(expired, await this.sweepExpiredStaging(actor, policy));
		}
		const redispatched = await this.each(await this.reads.listStaleAwaitingVerdict(actor, STALE_SCANNING_MAX_AGE_MS), "overdue scan", async (file) => {
			await this.dispatcher.redispatchScan(file.id);
			this.logger.warn(`Re-dispatched overdue scan for file ${file.id}`);
			return true;
		});
		return {
			abandonedDeleted: abandoned.done,
			expiredStagingDeleted: expired.done,
			scansRedispatched: redispatched.done,
			failures: abandoned.failed + expired.failed + redispatched.failed,
		};
	}

	private async sweepExpiredStaging(actor: ActorContext, policy: FileCategoryPolicy): Promise<SweepTally> {
		if (policy.stagingRetentionMs === undefined) {
			return { done: 0, failed: 0 };
		}
		return this.each(await this.reads.listExpiredStaging(actor, policy.category, policy.stagingRetentionMs), `unused ${policy.category}`, async (file) => {
			await this.deletion.delete(actor, { fileId: file.id, category: file.category, organizationId: file.organizationId }, STORAGE_CLEANUP_ACTOR);
			this.logger.log(`Cleaned unused ${policy.category} file ${file.id}`);
			return true;
		});
	}

	/** Row first, compare-and-set on PENDING: a completion racing the sweep wins, and then the bytes stay. */
	private async deleteAbandoned(actor: ActorContext, stale: StoredFileView): Promise<boolean> {
		const deleted = await this.uow.run(actor, async (scope): Promise<boolean> => {
			const file = await scope.storedFiles.findLive(stale.id);
			if (file?.status !== "PENDING") {
				return false;
			}
			file.delete(STORAGE_CLEANUP_ACTOR, this.clock.now());
			if ((await scope.storedFiles.save(file)) === "lost-race") {
				return false;
			}
			scope.events.collectFrom(file);
			return true;
		});
		if (deleted) {
			this.logger.log(`Cleaned stale pending file ${stale.id}`);
		}
		return deleted;
	}

	private async each(files: readonly StoredFileView[], label: string, work: (file: StoredFileView) => Promise<boolean>): Promise<SweepTally> {
		let tally: SweepTally = { done: 0, failed: 0 };
		for (const file of files) {
			try {
				tally = add(tally, (await work(file)) ? { done: 1, failed: 0 } : { done: 0, failed: 0 });
			} catch (error) {
				this.logger.error(`Failed to clean ${label} file ${file.id}: ${error instanceof Error ? error.message : String(error)}`);
				tally = add(tally, { done: 0, failed: 1 });
			}
		}
		return tally;
	}
}

interface SweepTally {
	readonly done: number;
	readonly failed: number;
}

function add(left: SweepTally, right: SweepTally): SweepTally {
	return { done: left.done + right.done, failed: left.failed + right.failed };
}
