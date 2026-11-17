import "server-only";

import { readRequestLanguage } from "@workspace/client/lib/i18n/request-language";
import { isFlagOn, type FeatureFlagBundle, type FeatureFlagKey } from "@workspace/shared";
import { cache } from "react";

import { createWebServerCaller } from "@/lib/web-server-api";

/**
 * The web app's feature flag bundle for this request (ADR 087), asked once per request: the API's evaluated values
 * for the signed-in customer, or for the browser's device when signed out (the proxy forwards its device id). Null
 * when the API couldn't answer: every flag then reads as its code default, so a failed read never turns anything on.
 */
export const loadWebFeatureFlagBundle = cache(async (): Promise<FeatureFlagBundle | null> => {
	const locale = await readRequestLanguage();
	const [result] = await Promise.allSettled([createWebServerCaller().featureFlags.bundle.query({ app: "web", locale })]);
	if (result.status === "rejected") {
		console.error("[web] feature flag bundle could not be loaded; every flag reads as its default", result.reason);
		return null;
	}
	return result.value.data;
});

/** Whether one flag is on for this request's customer (or device). */
export async function isWebFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
	return isFlagOn(await loadWebFeatureFlagBundle(), key);
}
