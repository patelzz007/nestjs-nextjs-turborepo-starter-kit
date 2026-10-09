import { act, renderHook } from "@testing-library/react-native";
import * as React from "react";

import { sessionActions } from "./actions";
import { SessionStoreProvider, useEnrollmentReason, useMinimumVersion, useRootRoute, useSessionCommands, useSessionSnapshot, useSignedOutReason } from "./facade";
import { createSessionStore, type SessionStore } from "./store";

describe("createSessionStore", () => {
	it.each([sessionActions.signedOut("signedOut"), sessionActions.expired(), sessionActions.upgradeRequired(null)])(
		"clears the cached server state when the session is left (%o)",
		(action) => {
			const clearServerState = jest.fn();
			const store = createSessionStore({ clearServerState });
			store.dispatch(sessionActions.restored({ status: "signedIn", session: { scope: "full" } }));

			store.dispatch(action);

			expect(clearServerState).toHaveBeenCalledTimes(1);
		},
	);

	it("keeps the cache across a lock and an unlock", () => {
		const clearServerState = jest.fn();
		const store = createSessionStore({ clearServerState });
		store.dispatch(sessionActions.restored({ status: "signedIn", session: { scope: "full" } }));

		store.dispatch(sessionActions.locked());
		store.dispatch(sessionActions.unlocked({ scope: "full" }));

		expect(clearServerState).not.toHaveBeenCalled();
	});
});

describe("session facade", () => {
	function wrapperFor(store: SessionStore): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
		return function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
			return <SessionStoreProvider store={store}>{children}</SessionStoreProvider>;
		};
	}

	it("exposes narrow hooks and stable commands", async () => {
		const store = createSessionStore({ clearServerState: jest.fn() });
		const { result } = await renderHook(
			() => ({
				route: useRootRoute(),
				reason: useSignedOutReason(),
				enrollment: useEnrollmentReason(),
				minimum: useMinimumVersion(),
				commands: useSessionCommands(),
				snapshot: useSessionSnapshot(),
			}),
			{ wrapper: wrapperFor(store) },
		);
		expect(result.current.route).toBe("starting");

		await act((): void => {
			result.current.commands.restored({ status: "signedOut", reason: "none" });
		});
		expect(result.current.route).toBe("auth");
		expect(result.current.reason).toBe("none");

		await act((): void => {
			result.current.commands.signedIn({ scope: "restricted", enrollmentReason: "mfa_enrollment" });
		});
		expect(result.current.enrollment).toBe("mfa_enrollment");

		await act((): void => {
			result.current.commands.tokensRotated({ scope: "full" });
			result.current.commands.locked();
		});
		expect(result.current.route).toBe("lock");

		await act((): void => {
			result.current.commands.unlocked({ scope: "full" });
			result.current.commands.expired();
		});
		expect(result.current.reason).toBe("sessionExpired");

		await act((): void => {
			result.current.commands.signedOut("signedOut");
			result.current.commands.upgradeRequired("2.0.0");
		});
		expect(result.current.route).toBe("update-required");
		expect(result.current.minimum).toBe("2.0.0");
		expect(result.current.snapshot().status).toBe("upgradeRequired");
	});
});
