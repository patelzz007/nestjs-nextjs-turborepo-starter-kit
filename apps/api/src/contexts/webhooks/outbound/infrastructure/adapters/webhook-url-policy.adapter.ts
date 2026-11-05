import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { checkOutboundUrl } from "../../../../../platform/infrastructure/http/outbound/outbound-target-policy";
import type { WebhookUrlCheck, WebhookUrlPolicyPort } from "../../application/ports/webhook-url-policy.port";

/** The platform's outbound target rule (HTTPS, no credentials, no private host), with this deployment's loopback setting. */
@Injectable()
export class WebhookUrlPolicyAdapter implements WebhookUrlPolicyPort {
	public constructor(private readonly config: TypedConfigService) {}

	public check(url: string): WebhookUrlCheck {
		const checked = checkOutboundUrl(url, { allowLoopback: this.config.webhooks.allowLoopbackUrls });
		return checked.ok ? { ok: true } : { ok: false, reason: checked.reason, message: checked.message };
	}
}
