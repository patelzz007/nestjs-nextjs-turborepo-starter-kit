import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { DocsSyncStarted } from "@workspace/shared";

import { DependencyUnavailableError, ExternalServiceError } from "../../../../../platform/application/errors/app-error";
import { DOCS_SYNC_DISPATCHER, type DocsSyncDispatcherPort } from "../../ports/docs-publishing.ports";
import { StartDocsSyncCommand } from "./start-docs-sync.command";

/** `POST /admin/docs-publishing/sync`. */
@Injectable()
@CommandHandler(StartDocsSyncCommand)
export class StartDocsSyncHandler implements ICommandHandler<StartDocsSyncCommand, DocsSyncStarted> {
	public constructor(@Inject(DOCS_SYNC_DISPATCHER) private readonly dispatcher: DocsSyncDispatcherPort | null) {}

	public async execute({ input }: StartDocsSyncCommand): Promise<DocsSyncStarted> {
		if (this.dispatcher === null) {
			throw new DependencyUnavailableError({ message: "This server cannot start a sync: set DOCS_SYNC_GITHUB_TOKEN, DOCS_SYNC_GITHUB_REPOSITORY and DOCS_SYNC_GITHUB_REF." });
		}
		try {
			await this.dispatcher.dispatch({ trigger: "MANUAL", full: input.full });
		} catch (error) {
			throw new ExternalServiceError({ message: "GitHub did not start the docs sync.", ...(error instanceof Error ? { cause: error } : {}) });
		}
		return { started: true };
	}
}
