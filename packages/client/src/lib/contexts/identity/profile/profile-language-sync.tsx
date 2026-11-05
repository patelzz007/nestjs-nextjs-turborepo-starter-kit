"use client";

// ============================================
// The person's language follows them (enhancement 5.2)
// ============================================
// A language chosen while signed in is saved on the profile (`PUT /auth/profile/language`); after sign-in on a
// device that hasn't chosen one (no `lang` cookie), the saved language applies. The device's own choice wins
// over the saved one. Saving is best-effort: the choice has already applied on this device, and a refused save
// (an impersonation session, which may not change the person's profile) changes nothing on screen.

import { UiKitLanguageSchema } from "@workspace/ui/lib/labels/language-packs";
import { useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import * as React from "react";

import { hasLanguageCookie, useAppLanguageChoices } from "../../../i18n/app-language-provider";
import { useAuth } from "../index";

export interface ProfileLanguageSyncProps {
	/** The cookies this page sees; the browser's own by default (replaced in tests). */
	readonly readCookies?: () => string;
}

function documentCookies(): string {
	return document.cookie;
}

/** Keeps the signed-in person's language and the device's in step. Renders nothing. */
export function ProfileLanguageSync({ readCookies = documentCookies }: ProfileLanguageSyncProps): null {
	const { api, isAuthenticated } = useAuth();
	const choices = useAppLanguageChoices();
	const shown = useUiKitLanguage()?.language ?? "en";
	const saved = api.auth.profile.useQuery(undefined, { enabled: isAuthenticated }).data?.data.language;
	const { mutate: saveLanguage } = api.auth.setLanguage.useMutation();

	React.useEffect((): (() => void) | undefined => {
		if (choices === null || !isAuthenticated) {
			return undefined;
		}
		return choices.onChosen((language): void => {
			saveLanguage({ language });
		});
	}, [choices, isAuthenticated, saveLanguage]);

	React.useEffect((): void => {
		if (choices === null || !isAuthenticated || saved === undefined || saved === shown || hasLanguageCookie(readCookies())) {
			return;
		}
		const language = UiKitLanguageSchema.safeParse(saved);
		if (language.success) {
			choices.apply(language.data);
		}
	}, [choices, isAuthenticated, readCookies, saved, shown]);

	return null;
}
