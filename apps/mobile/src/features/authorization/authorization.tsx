// Showing and hiding by capability on the phone, the same way as the web apps: the session's CASL
// ability (built from @workspace/shared's `abilityRules`, namespace "platform") read through @casl/react's
// `<Can>` and `useAbility()`. The session's capabilities come from `GET /auth/permissions`; until they
// arrive, when they cannot, and outside any provider, the ability allows nothing (fail closed). Purely UX:
// the API checks every request again.

import { Ability } from "@casl/ability";
import { AbilityProvider, Can as CaslCan, type CanProps } from "@casl/react";
import { useQueryClient } from "@tanstack/react-query";
import { isCapabilityRefusal } from "@workspace/api-client";
import * as React from "react";
import { z } from "zod";

import { abilityRules, type AppAbility, type CapabilitySlug, type PermissionAction, type PermissionResource } from "@workspace/shared";

import { useApi } from "../../lib/api-context";

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

const QueryErrorSchema = z.instanceof(Error);

/** The ability for the session's `platform:*` capabilities (@workspace/shared's `abilityRules`); none allows nothing. */
function defineSessionAbility(capabilities: readonly CapabilitySlug[]): AppAbility {
	return new Ability<[PermissionAction, PermissionResource]>(abilityRules(capabilities, "platform"));
}

/** The capabilities held, as the API listed them (the drawer filters its menu by the slugs). */
const CapabilitiesContext = React.createContext<readonly CapabilitySlug[]>(NO_CAPABILITIES);

/** The session's ability; outside a provider, the one that allows nothing (an empty capability list). */
const AbilityContext = React.createContext<AppAbility>(defineSessionAbility(NO_CAPABILITIES));

export interface SessionAbilityProviderProps {
	/** Granted capability slugs. Empty: nothing is allowed. */
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/**
 * Provides the session's ability (built from its `platform:*` capabilities) to `<Can>` and `useAbility()`
 * below it, and the raw capability list to `useCapabilities()`. A new list builds a new ability.
 */
export function SessionAbilityProvider({ capabilities, children }: SessionAbilityProviderProps): React.JSX.Element {
	const ability = React.useMemo((): AppAbility => defineSessionAbility(capabilities), [capabilities]);
	return (
		<CapabilitiesContext.Provider value={capabilities}>
			<AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
		</CapabilitiesContext.Provider>
	);
}

export interface SessionCapabilitiesProviderProps {
	readonly children: React.ReactNode;
}

/**
 * The signed-in session's ability (`GET /auth/permissions`), allowing nothing until the capabilities have loaded. A
 * request the API refuses for the session's capabilities (a role changed, a grant revoked) re-reads them.
 */
export function SessionCapabilitiesProvider({ children }: SessionCapabilitiesProviderProps): React.JSX.Element {
	const api = useApi();
	const permissions = api.auth.permissions.useQuery(undefined);
	const queryClient = useQueryClient();
	const { refetch } = permissions;
	React.useEffect((): (() => void) => {
		// The caches type errors loosely: each is validated (an Error) before it is read.
		const refreshOn = (error: z.ZodSafeParseResult<Error>): void => {
			if (error.success && isCapabilityRefusal(error.data)) {
				void refetch();
			}
		};
		const stopQueries = queryClient.getQueryCache().subscribe((event): void => {
			if (event.type === "updated" && event.action.type === "error") {
				refreshOn(QueryErrorSchema.safeParse(event.action.error));
			}
		});
		const stopMutations = queryClient.getMutationCache().subscribe((event): void => {
			if (event.type === "updated" && event.action.type === "error") {
				refreshOn(QueryErrorSchema.safeParse(event.action.error));
			}
		});
		return (): void => {
			stopQueries();
			stopMutations();
		};
	}, [queryClient, refetch]);
	return <SessionAbilityProvider capabilities={permissions.data?.data.capabilities ?? NO_CAPABILITIES}>{children}</SessionAbilityProvider>;
}

/** The capabilities held, for filtering a whole menu at once; none outside a provider. */
export function useCapabilities(): readonly CapabilitySlug[] {
	return React.useContext(CapabilitiesContext);
}

/** The session's ability: `const ability = useAbility(); ability.can("LIST", "SERVER_METRIC")`. Allows nothing outside a provider. */
export function useAbility(): AppAbility {
	return React.useContext(AbilityContext);
}

/**
 * @casl/react's `<Can>`, bound to the session ability: `<Can I="LIST" a="SERVER_METRIC">…</Can>`. Also `not`,
 * `passThrough` and a render function `{({ isAllowed }) => …}` (for a fallback). Denies outside a provider
 * (@casl/react's own `<Can>` reads only its own context and throws without it).
 */
export function Can(props: CanProps<AppAbility>): React.ReactNode {
	const ability = useAbility();
	return (
		<AbilityProvider value={ability}>
			<CaslCan {...props} />
		</AbilityProvider>
	);
}
