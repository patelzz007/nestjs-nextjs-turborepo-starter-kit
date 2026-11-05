import "server-only";

import { headers } from "next/headers";

import { SECURITY_NONCE_HEADER } from "./security-headers";

/**
 * This request's CSP nonce, set by the app's `proxy.ts` (`withSecurityHeaders`): a root layout hands it to
 * the inline scripts it renders itself (next-themes' anti-flash script). Next.js stamps its own scripts.
 * `undefined` only where the proxy didn't run (its matcher skips static files, which render no scripts).
 */
export async function readSecurityNonce(): Promise<string | undefined> {
	return (await headers()).get(SECURITY_NONCE_HEADER) ?? undefined;
}

/** Spread onto a component's props: `nonce` when there is one, nothing otherwise. */
export function nonceProps(nonce: string | undefined): { readonly nonce?: string } {
	return nonce === undefined ? {} : { nonce };
}
