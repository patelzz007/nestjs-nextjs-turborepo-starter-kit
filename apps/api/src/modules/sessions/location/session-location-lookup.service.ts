import { Inject, Injectable, Logger } from "@nestjs/common";
import { SessionLocationSchema, type SessionLocation } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { SESSION_LOCATION_RESOLVER, type SessionLocationResolver } from "./session-location.port";

/** The lookup did not answer within `SESSION_LOCATION_TIMEOUT_MS`. */
export class SessionLocationTimeoutError extends Error {
	public constructor(timeoutMs: number) {
		super(`Session location lookup timed out after ${String(timeoutMs)} ms`);
		this.name = "SessionLocationTimeoutError";
	}
}

/**
 * Looks up where a device session signs in from — best effort, by design
 * (docs/technical/mobile/mobile-app.md §8.7):
 * - the configured {@link SessionLocationResolver} gets at most
 *   `SESSION_LOCATION_TIMEOUT_MS`;
 * - its answer is a third-party boundary and is validated with the shared
 *   `SessionLocationSchema`;
 * - a timeout, an error or an invalid answer is logged and the session is
 *   stored without a location. A sign-in is never blocked or failed by it.
 */
@Injectable()
export class SessionLocationLookupService {
	private readonly logger: Logger = new Logger(SessionLocationLookupService.name);

	public constructor(
		@Inject(SESSION_LOCATION_RESOLVER) private readonly resolver: SessionLocationResolver,
		private readonly config: TypedConfigService,
	) {}

	public async lookup(ipAddress: string | null): Promise<SessionLocation | null> {
		if (ipAddress === null) {
			return null;
		}
		const timeoutMs: number = this.config.sessions.locationTimeoutMs;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<SessionLocation | null>((_resolve, reject): void => {
			timer = setTimeout((): void => {
				reject(new SessionLocationTimeoutError(timeoutMs));
			}, timeoutMs);
		});
		try {
			const answer: SessionLocation | null = await Promise.race([this.resolver.resolve(ipAddress), timeout]);
			if (answer === null) {
				return null;
			}
			const parsed = SessionLocationSchema.safeParse(answer);
			if (!parsed.success) {
				this.logger.warn("Session location lookup answered an invalid location; the session is stored without one");
				return null;
			}
			return parsed.data;
		} catch (error) {
			this.logger.warn(`Session location lookup failed; the session is stored without a location: ${error instanceof Error ? error.message : "unknown error"}`);
			return null;
		} finally {
			clearTimeout(timer);
		}
	}
}
