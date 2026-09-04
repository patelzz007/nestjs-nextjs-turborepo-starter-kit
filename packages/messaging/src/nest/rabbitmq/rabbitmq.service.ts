import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import type { MessagingHealthIndicator } from "../../core/health";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { MESSAGING_OPTIONS } from "../tokens";

/**
 * RabbitMQ placeholder — URL is read and surfaced for health/docs.
 * Wire `amqplib` consumers here when a non-Node worker is needed.
 */
@Injectable()
export class RabbitMqService implements OnModuleInit {
	private readonly logger: Logger = new Logger(RabbitMqService.name);

	public constructor(@Inject(MESSAGING_OPTIONS) private readonly options: ResolvedMessagingOptions) {}

	public isEnabled(): boolean {
		return this.options.rabbitmqUrl !== undefined;
	}

	public onModuleInit(): void {
		if (!this.isEnabled()) {
			return;
		}
		this.logger.log("RabbitMQ URL is configured — no API consumers wired yet (see docs/adr/rabbitmq-placeholder.md)");
	}
}

/** No-op when RabbitMQ URL is unset. */
@Injectable()
export class DisabledRabbitMqService {
	public isEnabled(): boolean {
		return false;
	}
}

@Injectable()
export class RabbitMqHealthIndicator implements MessagingHealthIndicator {
	public constructor(private readonly rabbit: RabbitMqService) {}

	public async isHealthy(): Promise<boolean> {
		return true;
	}

	public getReport(): Promise<Record<string, string>> {
		return Promise.resolve({
			backend: this.rabbit.isEnabled() ? "placeholder" : "disabled",
			url: this.rabbit.isEnabled() ? "configured" : "unset",
		});
	}
}
