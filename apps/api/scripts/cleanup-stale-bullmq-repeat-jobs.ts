import { Queue, hasLegacyRepeatableKeyShape } from "bullmq";

import { ALL_QUEUE_NAMES } from "@workspace/shared";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const redisUrl = process.env.REDIS_URL;
const prefix = process.env.BULLMQ_PREFIX ?? process.env.BULL_PREFIX ?? "bull";

if (redisUrl === undefined || redisUrl.length === 0) {
	console.error("REDIS_URL is required. Set it to the same Redis instance used by BullMQ.");
	process.exitCode = 1;
	process.exit();
}

if (!force && !dryRun) {
	console.warn("This is a destructive one-off cleanup. Re-run with --force to actually delete stale repeat jobs.");
	console.warn("Use --dry-run to preview what would be removed without deleting anything.");
	process.exitCode = 1;
	process.exit();
}

const queueNames = [...ALL_QUEUE_NAMES];
const staleRepeatPrefixes = ["repeat:"];

async function findBrokenRepeatJobs(queue: Queue): Promise<string[]> {
	const schedulerKeys = await queue.getJobSchedulers(0, -1, true);
	const matchingSchedulerKeys = schedulerKeys
		.filter((scheduler) => {
			const key = scheduler.key;
			return key.startsWith("repeat:") || hasLegacyRepeatableKeyShape(key);
		})
		.map((scheduler) => scheduler.key);

	const jobs = await queue.getJobs(["delayed", "waiting", "active", "failed"], 0, 500);
	const matchingJobIds = jobs
		.filter((job) => {
			const jobId = job.id ?? "";
			const repeatKey = job.repeatJobKey ?? "";
			const isBrokenJobId = jobId.startsWith("repeat:") || repeatKey.startsWith("repeat:");
			const isLegacy = repeatKey.length > 0 && hasLegacyRepeatableKeyShape(repeatKey);
			const isCorruptTimestamp = job.timestamp <= 0;
			return isBrokenJobId || isLegacy || isCorruptTimestamp;
		})
		.map((job) => job.id ?? "");

	return [...new Set([...matchingSchedulerKeys, ...matchingJobIds])];
}

async function removeSchedulerKey(queue: Queue, key: string): Promise<void> {
	await queue.removeJobScheduler(key);
}

async function removeJob(queue: Queue, jobId: string): Promise<void> {
	const job = await queue.getJob(jobId);
	if (job !== undefined) {
		await job.remove();
	}
}

async function main(): Promise<void> {
	for (const queueName of queueNames) {
		const queue = new Queue(queueName, {
			connection: { ...(redisUrl === undefined ? {} : { url: redisUrl }), maxRetriesPerRequest: null },
			prefix,
		});

		const keysToDelete = await findBrokenRepeatJobs(queue);
		if (keysToDelete.length === 0) {
			console.log(`Queue ${queueName}: no stale repeat jobs found.`);
			await queue.close();
			continue;
		}

		console.log(`Queue ${queueName}: found ${keysToDelete.length} stale repeat entries.`);
		for (const key of keysToDelete) {
			const isSchedulerKey = staleRepeatPrefixes.some((prefixValue) => key.startsWith(prefixValue));
			console.log(`${dryRun ? "Would remove" : "Removing"} ${isSchedulerKey ? "scheduler" : "job"}: ${key}`);
			if (!dryRun && force) {
				try {
					if (isSchedulerKey) {
						await removeSchedulerKey(queue, key);
					} else {
						await removeJob(queue, key);
					}
				} catch (error) {
					console.warn(`Failed to delete ${key}: ${String(error)}`);
				}
			}
		}
		await queue.close();
	}

	if (dryRun) {
		console.log("Dry run complete. No jobs were deleted.");
	} else {
		console.log("Cleanup complete.");
	}
}

await main();
