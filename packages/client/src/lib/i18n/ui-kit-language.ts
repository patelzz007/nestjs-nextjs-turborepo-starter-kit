import { UI_KIT_LANGUAGES, UiKitLanguageSchema, type UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";

/**
 * The language a screen falls back to when nothing chooses another (ADR 076): English, the source pack.
 * Each app's root layout resolves the request's language with {@link resolveUiKitLanguage} and mounts
 * `<UiKitLanguageProvider language={…}>` with it.
 */
export const PLATFORM_UI_KIT_LANGUAGE: UiKitLanguage = "en";

/** The cookie a language picker sets (and a signed-in user's saved preference is mirrored into). */
export const LANGUAGE_COOKIE = "lang";

/** One weighted entry of an `Accept-Language` header: `ms-MY;q=0.8` → { tag: "ms-MY", quality: 0.8 }. */
const ACCEPT_LANGUAGE_ENTRY = /^\s*(?<tag>[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*|\*)\s*(?:;\s*q\s*=\s*(?<quality>[01](?:\.\d{0,3})?))?\s*$/u;

/** Chinese written in Simplified characters: the tags Malaysian and Singaporean browsers send. */
const SIMPLIFIED_CHINESE_TAGS: readonly string[] = ["zh", "zh-hans", "zh-my", "zh-sg", "zh-cn"];

/** The shipped language a BCP 47 tag means, if any: `ms-MY` → `ms`, `zh-Hans-MY` → `zh-Hans`, `ta-IN` → `ta`. */
export function uiKitLanguageOfTag(tag: string): UiKitLanguage | null {
	const lower = tag.toLowerCase();
	const [primary = ""] = lower.split("-");
	if (primary === "zh") {
		const script = lower.split("-").slice(0, 2).join("-");
		return SIMPLIFIED_CHINESE_TAGS.includes(lower) || SIMPLIFIED_CHINESE_TAGS.includes(script) ? "zh-Hans" : null;
	}
	// Malay is also tagged `zsm` (Standard Malaysian Malay) by a few platforms.
	const parsed = UiKitLanguageSchema.safeParse(primary === "zsm" ? "ms" : primary);
	return parsed.success ? parsed.data : null;
}

/** The best shipped language an `Accept-Language` header asks for, by its quality weights; null when none. */
export function uiKitLanguageOfAcceptLanguage(header: string | null): UiKitLanguage | null {
	if (header === null) {
		return null;
	}
	const ranked = header
		.split(",")
		.flatMap((entry: string, index: number) => {
			const groups = ACCEPT_LANGUAGE_ENTRY.exec(entry)?.groups;
			const tag = groups?.tag;
			if (tag === undefined || tag === "*") {
				return [];
			}
			return [{ tag, quality: groups?.quality === undefined ? 1 : Number(groups.quality), index }];
		})
		.filter((entry) => entry.quality > 0)
		.sort((left, right) => right.quality - left.quality || left.index - right.index);
	for (const entry of ranked) {
		const language = uiKitLanguageOfTag(entry.tag);
		if (language !== null) {
			return language;
		}
	}
	return null;
}

/** The request's language: the `lang` cookie, then `Accept-Language`, then English. */
export function resolveUiKitLanguage({ cookie, acceptLanguage }: { readonly cookie: string | undefined; readonly acceptLanguage: string | null }): UiKitLanguage {
	const chosen = UiKitLanguageSchema.safeParse(cookie);
	if (chosen.success) {
		return chosen.data;
	}
	return uiKitLanguageOfAcceptLanguage(acceptLanguage) ?? PLATFORM_UI_KIT_LANGUAGE;
}

/** Every language a picker offers, in pack order. */
export const PICKABLE_UI_KIT_LANGUAGES: readonly UiKitLanguage[] = UI_KIT_LANGUAGES;
