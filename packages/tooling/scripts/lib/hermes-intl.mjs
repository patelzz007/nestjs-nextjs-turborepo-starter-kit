/**
 * Intl APIs that Hermes — React Native's JavaScript engine — does not
 * implement. Code that runs in the mobile app must not use them: `new
 * Intl.RelativeTimeFormat()` throws "undefined cannot be used as a constructor"
 * on a device, while Jest runs on Node, which HAS them, so no unit test can
 * catch it. Hermes implements Collator, DateTimeFormat and NumberFormat (and the
 * `toLocale…String` methods); everything below must be done another way (the
 * kit's RelativeTime builds its wording from labels).
 */
import { stripComments } from "./ui-native-kit-contract.mjs";

export const HERMES_MISSING_INTL_APIS = ["RelativeTimeFormat", "ListFormat", "PluralRules", "DisplayNames", "Segmenter", "Locale"];

/** The source code that runs on Hermes: the mobile app, its UI kit, and the packages it bundles. */
export const HERMES_SOURCE_ROOTS = ["apps/mobile/src", "packages/ui-native/src", "packages/shared/src", "packages/api-client/src"];

const MISSING_INTL_USE = new RegExp(`\\bIntl\\.(?<api>${HERMES_MISSING_INTL_APIS.join("|")})\\b`, "gu");

/**
 * The Hermes-missing Intl APIs a source file uses (comments ignored).
 *
 * @param {string} source
 * @returns {string[]}
 */
export function hermesMissingIntlUses(source) {
	return [...stripComments(source).matchAll(MISSING_INTL_USE)].map((match) => `Intl.${match.groups.api}`);
}
