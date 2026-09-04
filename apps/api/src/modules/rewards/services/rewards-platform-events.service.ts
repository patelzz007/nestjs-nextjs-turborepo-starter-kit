import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

import { type RewardPlatformEvent } from "@workspace/shared";

export const REWARD_PLATFORM_EVENT = "reward.platform";

/** In-process reward platform events — drained into the transactional outbox. */
@Injectable()
export class RewardsPlatformEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	public emit(event: RewardPlatformEvent): void {
		this.emitter.emit(REWARD_PLATFORM_EVENT, event);
	}

	public observe(): Observable<RewardPlatformEvent> {
		return new Observable<RewardPlatformEvent>((subscriber) => {
			const handler = (event: RewardPlatformEvent): void => {
				subscriber.next(event);
			};
			this.emitter.on(REWARD_PLATFORM_EVENT, handler);
			return (): void => {
				this.emitter.off(REWARD_PLATFORM_EVENT, handler);
			};
		});
	}
}
