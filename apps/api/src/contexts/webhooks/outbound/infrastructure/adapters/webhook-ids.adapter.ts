import { Injectable } from "@nestjs/common";
import { newRowId } from "@workspace/shared";

import type { WebhookIdGenerator } from "../../application/ports/webhook-ids.port";

/** UUIDv7 row ids, chosen before insert so an event can be appended without reading it back. */
@Injectable()
export class WebhookIdsAdapter implements WebhookIdGenerator {
	public next(): string {
		return newRowId();
	}
}
