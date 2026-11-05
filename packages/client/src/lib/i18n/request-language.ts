import "server-only";

import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import { cookies, headers } from "next/headers";

import { LANGUAGE_COOKIE, resolveUiKitLanguage } from "./ui-kit-language";

/** This request's language (ADR 076), for a root layout: the `lang` cookie, then `Accept-Language`, then English. */
export async function readRequestLanguage(): Promise<UiKitLanguage> {
	const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
	return resolveUiKitLanguage({ cookie: cookieStore.get(LANGUAGE_COOKIE)?.value, acceptLanguage: requestHeaders.get("accept-language") });
}
