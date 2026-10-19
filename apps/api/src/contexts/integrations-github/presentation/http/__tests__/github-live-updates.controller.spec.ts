import type { MessageEvent } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { firstValueFrom, take, toArray } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { ActorContextFactory } from "../../../../../platform/presentation/http/security/actor-context.factory";
import { userActor } from "../../../application/__tests__/fakes/github-contract.fixtures";
import { ManualChangeSignals } from "../../../application/__tests__/fakes/github-fakes";
import { GITHUB_CHANGE_SIGNALS } from "../../../application/ports/github.tokens";
import { GITHUB_LIVE_UPDATES_KEEPALIVE_MS, GithubLiveUpdatesController } from "../github-live-updates.controller";

async function controllerWith(signals: ManualChangeSignals): Promise<GithubLiveUpdatesController> {
	const moduleRef = await Test.createTestingModule({
		imports: [CqrsModule.forRoot()],
		controllers: [GithubLiveUpdatesController],
		providers: [
			{ provide: GITHUB_CHANGE_SIGNALS, useValue: signals },
			// The stream route's visibility guard is its own spec; this one never opens it.
			{ provide: ActorContextFactory, useValue: { fromHttpRequest: (): ActorContext => userActor() } },
		],
	}).compile();
	return moduleRef.get(GithubLiveUpdatesController);
}

describe("GithubLiveUpdatesController.stream", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("streams only this repository's changes (names compared without case), and every resync", async () => {
		const signals = new ManualChangeSignals();
		const frames = firstValueFrom((await controllerWith(signals)).stream({ owner: "octo-org", repository: "hello-world" }).pipe(take(2), toArray()));

		signals.signals.next({ kind: "change", change: { owner: "someone", repository: "secret", number: 1 } });
		signals.signals.next({ kind: "change", change: { owner: "Octo-Org", repository: "Hello-World", number: 42 } });
		signals.signals.next({ kind: "resync" });

		await expect(frames).resolves.toEqual([{ data: { owner: "Octo-Org", repository: "Hello-World", number: 42 } }, { type: "resync", data: "" }]);
	});

	it("pings an idle stream so proxies keep it open", async () => {
		vi.useFakeTimers();
		const frames: MessageEvent[] = [];
		const subscription = (await controllerWith(new ManualChangeSignals())).stream({ owner: "octo-org", repository: "hello-world" }).subscribe((frame: MessageEvent): void => {
			frames.push(frame);
		});

		await vi.advanceTimersByTimeAsync(GITHUB_LIVE_UPDATES_KEEPALIVE_MS);

		expect(frames).toEqual([{ type: "ping", data: "" }]);
		subscription.unsubscribe();
	});
});
