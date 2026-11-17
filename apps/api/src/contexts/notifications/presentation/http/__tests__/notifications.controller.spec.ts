import { describe, expect, it } from "vitest";

import { NotificationsController } from "../notifications.controller";

/**
 * The metadata key `@SkipThrottle({ name: true })` writes, per throttler (`THROTTLER:SKIP<name>`). `@nestjs/throttler`
 * defines it as `THROTTLER_SKIP` but does not export it from its entry point.
 */
const THROTTLER_SKIP_KEY = "THROTTLER:SKIP";

type BellRead = "inbox" | "unreadCount" | "stream";
type CheckedRoute = BellRead | "read" | "preferences";

/** One decorated handler of the controller (read off its property descriptor). */
function handlerOf<TRoute extends CheckedRoute>(route: TRoute): NotificationsController[TRoute] {
	const descriptor: TypedPropertyDescriptor<NotificationsController[TRoute]> | undefined = Object.getOwnPropertyDescriptor(NotificationsController.prototype, route);
	const handler: NotificationsController[TRoute] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`NotificationsController.${route} is not a method`);
	}
	return handler;
}

function skipsThrottler(route: CheckedRoute, throttler: string): boolean {
	return Reflect.getMetadata(`${THROTTLER_SKIP_KEY}${throttler}`, handlerOf(route)) === true;
}

describe("NotificationsController throttling", () => {
	it.each<BellRead>(["inbox", "unreadCount", "stream"])(
		"%s is a bell read on every page: off the per-IP strict throttler, still under the default and preAuth ones",
		(route) => {
			// Three browser suites in a row over-ran the shared per-IP count of these routes; the refused stream refreshed
			// the session from parallel requests and the API ended it as a stolen token.
			expect(skipsThrottler(route, "strict")).toBe(true);
			expect(skipsThrottler(route, "default")).toBe(false);
			expect(skipsThrottler(route, "preAuth")).toBe(false);
		},
	);

	it("a mutation stays on its per-user policy (ADR 071: off strict, under default)", () => {
		expect(skipsThrottler("read", "strict")).toBe(true);
		expect(skipsThrottler("read", "default")).toBe(false);
	});

	it("a read outside the bell keeps every throttler", () => {
		expect(skipsThrottler("preferences", "strict")).toBe(false);
		expect(skipsThrottler("preferences", "default")).toBe(false);
	});
});
