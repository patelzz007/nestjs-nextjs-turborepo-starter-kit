import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { DocsWebhookHandshake } from "@workspace/shared";

import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import { DOCS_WEBHOOK_HANDSHAKE_STORE, type DocsWebhookHandshakeStorePort } from "../../ports/docs-publishing.ports";
import { RevealDocsWebhookHandshakeCommand } from "./reveal-docs-webhook-handshake.command";

/** `POST /admin/docs-publishing/webhook-handshake/reveal`; 404 when no token is waiting. */
@Injectable()
@CommandHandler(RevealDocsWebhookHandshakeCommand)
export class RevealDocsWebhookHandshakeHandler implements ICommandHandler<RevealDocsWebhookHandshakeCommand, DocsWebhookHandshake> {
	public constructor(@Inject(DOCS_WEBHOOK_HANDSHAKE_STORE) private readonly handshakes: DocsWebhookHandshakeStorePort) {}

	public async execute(): Promise<DocsWebhookHandshake> {
		const handshake = await this.handshakes.find("NOTION");
		if (handshake === null) {
			throw new NotFoundError({ message: "No verification token is waiting. Ask Notion to send it again." });
		}
		return handshake;
	}
}
