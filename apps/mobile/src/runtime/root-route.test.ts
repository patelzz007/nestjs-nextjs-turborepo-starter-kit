import type { RootRoute } from "../features/session/selectors";
import { resolveRootRoute } from "./root-route";

describe("resolveRootRoute", () => {
	it("shows onboarding to a signed-out device that has not been through it", () => {
		expect(resolveRootRoute({ sessionRoute: "auth", isSignedOut: true, onboardingCompleted: false })).toBe("onboarding");
	});

	it("goes to sign-in once onboarding is done", () => {
		expect(resolveRootRoute({ sessionRoute: "auth", isSignedOut: true, onboardingCompleted: true })).toBe("auth");
	});

	it.each<RootRoute>(["starting", "app", "lock", "update-required", "config-error", "auth"])("never interrupts a session that is not signed out (%s)", (sessionRoute) => {
		expect(resolveRootRoute({ sessionRoute, isSignedOut: false, onboardingCompleted: false })).toBe(sessionRoute);
	});
});
