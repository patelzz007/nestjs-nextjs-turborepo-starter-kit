// ============================================
// pos.ts - the till's calls, authorized by a terminal API key
// ============================================
// A POS terminal is a machine principal (ADR 017): it pairs once with the
// one-time code from the merchant console (`POST /pos/terminals/pair`, public),
// then validates and checks out redemptions with its own API key
// (`X-API-Key`) and terminal id (`X-Terminal-Id`). None of these calls may
// carry the signed-in person's session: the API reads `Authorization: Bearer`
// as the API key first, so a person's access token there would be refused as
// an invalid key. They are kept out of `apiRouter` for that reason and go out
// through a context built by {@link createPosRequestContext}: no access token,
// no cookies, no 401 refresh.

import {
	apiContract,
	type Envelope,
	type PosPairedTerminal,
	type PosPairTerminalInput,
	type PosTerminalId,
	type RedemptionCheckoutInput,
	type RedemptionCheckoutResponse,
	type RedemptionPreviewResponse,
	type RedemptionValidateInput,
} from "@workspace/shared";

import { defineMutation } from "./router";
import { createMutationCaller, type ApiRequestContext, type MutationCaller } from "./request";
import { ANONYMOUS_TOKEN_REQUEST_TRANSPORT } from "./transport";

/** The header a till presents its API key in. */
export const POS_API_KEY_HEADER = "X-API-Key";

/** The header naming the till (identifies, never authenticates — see `PosTerminalIdSchema`). */
export const POS_TERMINAL_ID_HEADER = "X-Terminal-Id";

/** What a paired till presents with every redemption call. */
export interface PosTerminalCredentials {
	readonly apiKey: string;
	readonly terminalId: PosTerminalId;
}

/** The till's procedures. Call them only through a {@link createPosRequestContext} context. */
export const posRouter = {
	pos: {
		pairTerminal: defineMutation(apiContract.pos.pairTerminal),
	},
	redemptions: {
		validate: defineMutation(apiContract.redemptions.validate),
		checkout: defineMutation(apiContract.redemptions.checkout),
	},
};

/** The headers a paired till sends with every redemption call. */
export function posCredentialHeaders(credentials: PosTerminalCredentials): Readonly<Record<string, string>> {
	return { [POS_API_KEY_HEADER]: credentials.apiKey, [POS_TERMINAL_ID_HEADER]: credentials.terminalId };
}

/**
 * A request context for the till's calls, derived from the app's own context
 * (same API address, client type, app version and static headers) but with no
 * session: `credentials` add the terminal's API key and id; `null` is for the
 * one call made before the till has a key (pairing).
 */
export function createPosRequestContext(context: ApiRequestContext, credentials: PosTerminalCredentials | null): ApiRequestContext {
	return {
		baseUrl: context.baseUrl,
		clientType: context.clientType,
		appVersion: context.appVersion,
		headers: { ...context.headers, ...(credentials === null ? {} : posCredentialHeaders(credentials)) },
		transport: ANONYMOUS_TOKEN_REQUEST_TRANSPORT,
	};
}

/** The till's calls, bound to one {@link createPosRequestContext} context. */
export interface PosCaller {
	/** `POST /pos/terminals/pair` — the one call made before the till has a key. */
	readonly pairTerminal: MutationCaller<PosPairTerminalInput, Envelope<PosPairedTerminal>>;
	/** `POST /redemptions/validate` — what a scanned code is, and whether it can be redeemed here. */
	readonly validate: MutationCaller<RedemptionValidateInput, Envelope<RedemptionPreviewResponse>>;
	/** `POST /redemptions/checkout` — redeem codes on a paid bill (idempotent by its key). */
	readonly checkout: MutationCaller<RedemptionCheckoutInput, Envelope<RedemptionCheckoutResponse>>;
}

/** The till's callers over the app's context, with the terminal's credentials (`null` before pairing). */
export function createPosCaller(context: ApiRequestContext, credentials: PosTerminalCredentials | null): PosCaller {
	const posContext = createPosRequestContext(context, credentials);
	return {
		pairTerminal: createMutationCaller(posContext, posRouter.pos.pairTerminal),
		validate: createMutationCaller(posContext, posRouter.redemptions.validate),
		checkout: createMutationCaller(posContext, posRouter.redemptions.checkout),
	};
}
