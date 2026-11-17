import { describe, expect, it } from "vitest";

import { FeatureFlagsClientController } from "../feature-flags-client.controller";

/**
 * The metadata key `@SkipThrottle({ name: true })` writes, per throttler (`THROTTLER:SKIP<name>`). `@nestjs/throttler`
 * defines it as `THROTTLER_SKIP` but does not export it from its entry point.
 */
const THROTTLER_SKIP_KEY = "THROTTLER:SKIP";

type ClientRoute = "bundle" | "stream" | "record";

/** One decorated handler of the controller (read off its property descriptor). */
function handlerOf<TRoute extends ClientRoute>(route: TRoute): FeatureFlagsClientController[TRoute] {
	const descriptor: TypedPropertyDescriptor<FeatureFlagsClientController[TRoute]> | undefined = Object.getOwnPropertyDescriptor(FeatureFlagsClientController.prototype, route);
	const handler: FeatureFlagsClientController[TRoute] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`FeatureFlagsClientController.${route} is not a method`);
	}
	return handler;
}

function skipsThrottler(route: ClientRoute, throttler: string): boolean {
	return Reflect.getMetadata(`${THROTTLER_SKIP_KEY}${throttler}`, handlerOf(route)) === true;
}

describe("FeatureFlagsClientController throttling", () => {
	it.each<ClientRoute>(["bundle", "stream"])("%s is a page-load read: off the per-IP strict throttler, still under the default and preAuth ones", (route) => {
		// Every server render of every app reads the bundle from the renderer's one address; the credential throttler
		// refused it within seconds and every flag fell back to its default.
		expect(skipsThrottler(route, "strict")).toBe(true);
		expect(skipsThrottler(route, "default")).toBe(false);
		expect(skipsThrottler(route, "preAuth")).toBe(false);
	});

	it("exposures keep every throttler: they are counted under their own policy", () => {
		expect(skipsThrottler("record", "strict")).toBe(false);
		expect(skipsThrottler("record", "default")).toBe(false);
	});
});
