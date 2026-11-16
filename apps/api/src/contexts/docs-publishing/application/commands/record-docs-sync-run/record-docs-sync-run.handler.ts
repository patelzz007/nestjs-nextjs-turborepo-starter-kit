import { createHash, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { DocsSyncRunAck, DocsSyncRunReport, DocsSyncRunStatus } from "@workspace/shared";

import { AuthenticationError, DependencyUnavailableError } from "../../../../../platform/application/errors/app-error";
import { OPERATIONAL_ALERTS, type OperationalAlertPort } from "../../../../../platform/application/ports/operational-alert.port";
import { DOCS_PUBLISHING_SETTINGS, DOCS_SYNC_RUN_STORE, type DocsPublishingSettings, type DocsSyncRunStorePort } from "../../ports/docs-publishing.ports";
import { RecordDocsSyncRunCommand } from "./record-docs-sync-run.command";

/** Runs that need a person. A held-back page counts: its writer's change is not live. */
const TROUBLED_STATUSES: ReadonlySet<DocsSyncRunStatus> = new Set(["PARTIAL", "BLOCKED", "FAILED"]);

/** Hashed first, so the comparison is constant-time whatever the lengths. */
function sameToken(presented: string, expected: string): boolean {
	const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
	return timingSafeEqual(digest(presented), digest(expected));
}

/**
 * Records what the sync reported. A repeated failure raises one alert, not one per run: only a run that turns a good
 * state bad alerts, and the next good run clears the way for the next alert.
 */
@Injectable()
@CommandHandler(RecordDocsSyncRunCommand)
export class RecordDocsSyncRunHandler implements ICommandHandler<RecordDocsSyncRunCommand, DocsSyncRunAck> {
	public constructor(
		@Inject(DOCS_PUBLISHING_SETTINGS) private readonly settings: DocsPublishingSettings,
		@Inject(DOCS_SYNC_RUN_STORE) private readonly runs: DocsSyncRunStorePort,
		@Inject(OPERATIONAL_ALERTS) private readonly alerts: OperationalAlertPort,
	) {}

	public async execute({ token, report }: RecordDocsSyncRunCommand): Promise<DocsSyncRunAck> {
		const expected = this.settings.reportToken;
		if (expected === null) {
			throw new DependencyUnavailableError({ message: "This server takes no docs sync reports." });
		}
		if (token === null || !sameToken(token, expected)) {
			throw new AuthenticationError({ message: "The report token is not valid." });
		}
		const { isNew, previousStatus } = await this.runs.record(report);
		if (isNew && this.startsTrouble(report.status, previousStatus)) {
			this.raiseAlert(report);
		}
		return { recorded: true };
	}

	private startsTrouble(status: DocsSyncRunStatus, previous: DocsSyncRunStatus | null): boolean {
		return TROUBLED_STATUSES.has(status) && (previous === null || !TROUBLED_STATUSES.has(previous));
	}

	private raiseAlert(report: DocsSyncRunReport): void {
		this.alerts.raise({
			event: "docs_publishing.sync_needs_attention",
			message: "A docs sync needs attention. See Operations → Docs sync.",
			facts: { runId: report.runId, status: report.status, pagesHeldBack: report.pagesHeldBack },
		});
	}
}
