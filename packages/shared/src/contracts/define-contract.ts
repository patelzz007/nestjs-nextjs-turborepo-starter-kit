// The contract leaf builders (`defineContract` / `defineFileContract`) and their types.
// Lives apart from `contracts/index.ts` so every `contexts/<context>/contract.ts` can
// build its leaves without importing the composed `apiContract` (no import cycle).

import { z, type ZodType } from "zod";

import type { DataValue } from "../schemas/api/common";
import type { ApiFileResponseContract, ApiResponseContract } from "./response";

/**
 * Every procedure input is either a plain JSON object (path params + query
 * keys / body fields) or `undefined` (no-input procedures like `auth.me`).
 */
export type SerializableInput = Readonly<Record<string, DataValue | undefined>> | undefined;

// ── Route contract ─────────────────────────────────────────────────────────

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Who may call a contract route: anyone (`@Public()` on the API) or a signed-in session. */
export const ApiAccessSchema = z.enum(["public", "authenticated"]);
export type ApiAccess = z.output<typeof ApiAccessSchema>;

/**
 * One route of the contract: the wire method + path template + the single zod
 * input schema + the response contract. `M` keeps the literal method (so the
 * client router can tell query defs from mutation defs without any cast),
 * `Input` is constrained to JSON so the schema is a valid contract input on
 * both sides, and `Data` is the envelope's `data` type the client parses.
 *
 * A leaf names no API version: the client sends every call to the version its app pins (ADR 094).
 *
 * `access` mirrors the API: `"public"` exactly when the route is `@Public()`
 * (no session needed — `test/openapi-document.e2e-spec.ts` holds the two
 * equal); omitted means `"authenticated"`. Server-side callers use it to fetch
 * a public route for a visitor with no session instead of skipping it.
 */
export interface ApiContractDef<Input extends SerializableInput, M extends RestMethod = RestMethod, Data extends DataValue = DataValue> {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	/** What the endpoint answers with (`singleResponse` / `paginatedResponse`) — ADR 022. */
	readonly response: ApiResponseContract<Data>;
	/** Who may call the route; omitted = `"authenticated"`. */
	readonly access?: ApiAccess;
}

/** Declares one route in the contract. */
export function defineContract<Input extends SerializableInput, M extends RestMethod, Data extends DataValue>(
	def: ApiContractDef<Input, M, Data>,
): ApiContractDef<Input, M, Data> {
	return def;
}

/**
 * One FILE download route (an export): a GET whose success body is the file
 * itself (`fileResponse`), not the JSON envelope. It is a contract leaf like
 * any other — the API validates the same `input`, the OpenAPI e2e test holds
 * the handler's `@ZodFileResponse` to the same media types — but the client
 * fetches it with `fetchDownload` (a `Blob` + file name), never as a query.
 */
export interface ApiFileContractDef<Input extends SerializableInput> {
	readonly method: "GET";
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly response: ApiFileResponseContract;
	/** Who may call the route; omitted = `"authenticated"`. */
	readonly access?: ApiAccess;
}

/** Declares one file download route. */
export function defineFileContract<Input extends SerializableInput>(def: ApiFileContractDef<Input>): ApiFileContractDef<Input> {
	return def;
}

// ── Shared input helpers ─────────────────────────────────────────────────

/** No-input body (refresh/logout send an empty `{}`). */
export const EmptyInputSchema = z.object({}).strict();
