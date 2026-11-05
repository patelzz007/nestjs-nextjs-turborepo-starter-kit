// ============================================
// Language (ADR 076, enhancement 5.2) — English, Bahasa Melayu, 简体中文, தமிழ்
// ============================================
// Each language is named in itself, so a person who can't read the current one still finds theirs.
// Choosing one applies at once; the toast confirms it in the new language.

import type { AppLanguage } from "@workspace/shared";
import * as React from "react";

import { Card } from "@workspace/ui-native/components/card";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import { Screen } from "../../../components/screen";
import { APP_LANGUAGE_NAMES, APP_LANGUAGES } from "../../../features/language/app-languages";
import { useLanguageChoice } from "../../../features/language/use-language-choice";
import { PREFERENCES_LABELS } from "../../../features/preferences/labels";
import { useLabels } from "../../../features/language/use-app-language";
import { useToast } from "../../../features/toast/facade";

const LANGUAGE_OPTIONS: readonly RadioOption<AppLanguage>[] = APP_LANGUAGES.map((language: AppLanguage): RadioOption<AppLanguage> => ({
	value: language,
	label: APP_LANGUAGE_NAMES[language],
}));

export default function LanguageScreen(): React.JSX.Element {
	const { language, choose } = useLanguageChoice();
	const labels = useLabels(PREFERENCES_LABELS);
	const toast = useToast();
	const changeLanguage = React.useCallback(
		(next: AppLanguage): void => {
			if (next === language) {
				return;
			}
			choose(next);
			toast.success(PREFERENCES_LABELS[next].messages.languageChanged(APP_LANGUAGE_NAMES[next]));
		},
		[choose, language, toast],
	);
	return (
		<Screen description={labels.language.description}>
			<Card>
				<RadioGroup label={labels.language.label} options={LANGUAGE_OPTIONS} value={language} onChange={changeLanguage} />
			</Card>
		</Screen>
	);
}
