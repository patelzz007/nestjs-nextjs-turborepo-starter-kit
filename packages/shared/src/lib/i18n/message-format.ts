// ============================================
// message-format.ts - One ICU message, formatted in one language (ADR 076)
// ============================================
// Every translated string lives in a JSON catalogue, one file per language. A string that takes values is an ICU
// message: `{name}` for a value, `{count, plural, one {# item} other {# items}}` for plurals (by the language's own
// plural rules, `Intl.PluralRules`), `{mode, select, tree {…} other {…}}` for a choice. A translation can reorder,
// pluralise or choose freely, with no code per language. Each message is parsed once per language and kept.

import IntlMessageFormat from "intl-messageformat";

/** A value a message takes: text or a number (a plural's count). */
export type MessageValue = string | number;

/** The values one message takes, by placeholder name. */
export type MessageValues = Readonly<Record<string, MessageValue>>;

const parsedMessages = new Map<string, IntlMessageFormat>();

/** The parsed message for `language`, from the cache when it has been formatted before. */
function parsedMessage(language: string, message: string): IntlMessageFormat {
	const key = `${language}\u0000${message}`;
	const cached = parsedMessages.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const parsed = new IntlMessageFormat(message, language);
	parsedMessages.set(key, parsed);
	return parsed;
}

/**
 * `message` (ICU MessageFormat) formatted in `language` (a BCP 47 tag) with `values`. A placeholder the values
 * don't supply throws: the catalogue tests prove every message's placeholders match English's, and English's
 * match what its binding passes.
 */
export function formatMessage(language: string, message: string, values: MessageValues = {}): string {
	return parsedMessage(language, message)
		.formatToParts<string>(values)
		.map((part): string => part.value)
		.join("");
}
