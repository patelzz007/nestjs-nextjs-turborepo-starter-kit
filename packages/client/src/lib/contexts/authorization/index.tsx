"use client";

import { Ability } from "@casl/ability";
import { AbilityProvider, Can as CaslCan, type CanProps } from "@casl/react";
import * as React from "react";

import { abilityRules, type AppAbility, type CapabilityNamespace, type CapabilitySlug, type PermissionAction, type PermissionResource } from "@workspace/shared";

export type { AppAbility, CapabilityNamespace } from "@workspace/shared";

/**
 * The ability for a session's capabilities (@workspace/shared's `abilityRules`). An empty list (signed out, loading,
 * failed) allows nothing. The plain `Ability`, not `createMongoAbility`: the rules never carry a condition. Built here,
 * not in @workspace/shared, so CASL's code loads only on pages that mount an ability provider.
 */
export function defineSessionAbility(capabilities: readonly CapabilitySlug[], namespace: CapabilityNamespace): AppAbility {
	return new Ability<[PermissionAction, PermissionResource]>(abilityRules(capabilities, namespace));
}

/** The ability that allows nothing (an empty capability list). */
const DENY_ALL_ABILITY: AppAbility = defineSessionAbility([], "platform");

/**
 * The session's ability. Outside a {@link SessionAbilityProvider} it is the ability that allows nothing, so a
 * `<Can>` or `useAbility()` rendered where no provider is mounted hides what it guards instead of crashing.
 */
const AbilityContext = React.createContext<AppAbility>(DENY_ALL_ABILITY);

export interface SessionAbilityProviderProps {
	/** Granted capability slugs (`GET /auth/permissions`, or the merchant membership's). Empty: nothing is allowed. */
	readonly capabilities: readonly CapabilitySlug[];
	/** Which slugs this app's ability is built from (`platform` or `merchant`). */
	readonly namespace: CapabilityNamespace;
	readonly children: React.ReactNode;
}

/**
 * Provides the session's CASL ability to `<Can>` and `useAbility()` below it. A new capability list (sign-in, tenant
 * switch, a role change, sign-out) builds a new ability, so every check re-renders. Purely UX: the API and row-level
 * security check every request again.
 */
export function SessionAbilityProvider({ capabilities, namespace, children }: SessionAbilityProviderProps): React.JSX.Element {
	const ability = React.useMemo((): AppAbility => defineSessionAbility(capabilities, namespace), [capabilities, namespace]);
	return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

/** The session's ability: `const ability = useAbility(); ability.can("DELETE", "PRODUCT")`. Allows nothing outside a provider. */
export function useAbility(): AppAbility {
	return React.useContext(AbilityContext);
}

/**
 * @casl/react's `<Can>`, bound to the session ability: `<Can I="UPDATE" a="REWARD">…</Can>`. Also `not`,
 * `passThrough` and a render function `{({ isAllowed }) => …}` (for a fallback). Denies outside a provider:
 * @casl/react's own `<Can>` reads only its own context (and throws without it), so the session ability — or the
 * deny-all default — is handed to it here.
 */
export function Can(props: CanProps<AppAbility>): React.ReactNode {
	const ability = useAbility();
	return (
		<AbilityProvider value={ability}>
			<CaslCan {...props} />
		</AbilityProvider>
	);
}
