// ============================================
// message-catalog.ts - A language's JSON catalogue, and what makes it a complete translation (ADR 076)
// ============================================
// A catalogue is the JSON one language's copy lives in: nested groups of ICU messages (and lists, like month
// names). English is the source. A translation is complete when it has exactly English's keys, lists of English's
// lengths, and every message parses with exactly English's placeholders (same names, same kinds): a translation
// may reword, reorder and pluralise, never drop or invent a value. The compiler checks the keys as each language
// is typed against English's file; `catalogIssues` checks the rest, in each surface's catalogue test.

import { isStructurallySame, parse } from "@formatjs/icu-messageformat-parser";
import { z } from "zod";

/** One language's copy for a surface: groups of messages and lists of messages, nested. */
export interface MessageCatalog {
	readonly [key: string]: MessageCatalogEntry;
}

export type MessageCatalogEntry = string | readonly string[] | MessageCatalog;

const MessageListSchema = z.array(z.string()).readonly();

export const MessageCatalogSchema: z.ZodType<MessageCatalog> = z.lazy(() => z.record(z.string(), z.union([z.string(), MessageListSchema, MessageCatalogSchema])));

/** Why a message can't be used: it doesn't parse as ICU, or it takes other values than English's. */
function messageProblem(source: string, translation: string): string | null {
	try {
		const translated = parse(translation);
		const same = isStructurallySame(parse(source), translated);
		return same.success ? null : `takes other values than English's (${same.error?.message ?? "different placeholders"})`;
	} catch (cause) {
		return `is not a valid ICU message (${cause instanceof Error ? cause.message : "unreadable"})`;
	}
}

function entryIssues(path: string, source: MessageCatalogEntry, translation: MessageCatalogEntry): readonly string[] {
	const sourceText = z.string().safeParse(source);
	const sourceList = MessageListSchema.safeParse(source);
	const sourceGroup = MessageCatalogSchema.safeParse(source);
	if (sourceText.success) {
		const text = z.string().safeParse(translation);
		if (!text.success) {
			return [`${path}: should be a message`];
		}
		if (text.data.trim().length === 0 && sourceText.data.trim().length > 0) {
			return [`${path}: is empty`];
		}
		const problem = messageProblem(sourceText.data, text.data);
		return problem === null ? [] : [`${path}: ${problem}`];
	}
	if (sourceList.success) {
		const list = MessageListSchema.safeParse(translation);
		if (!list.success) {
			return [`${path}: should be a list`];
		}
		if (list.data.length !== sourceList.data.length) {
			return [`${path}: has ${String(list.data.length)} entries, English has ${String(sourceList.data.length)}`];
		}
		return sourceList.data.flatMap((entry: string, index: number): readonly string[] => entryIssues(`${path}[${String(index)}]`, entry, list.data[index] ?? ""));
	}
	const group = MessageCatalogSchema.safeParse(translation);
	if (!sourceGroup.success || !group.success) {
		return [`${path}: should be a group`];
	}
	return catalogIssues(sourceGroup.data, group.data, path);
}

/**
 * Every way `translation` falls short of `source` (English): keys missing or extra, lists of the wrong length,
 * messages empty, unparsable, or taking other values. Empty means complete.
 */
export function catalogIssues(source: MessageCatalog, translation: MessageCatalog, path = ""): readonly string[] {
	const at = (key: string): string => (path.length === 0 ? key : `${path}.${key}`);
	const extra = Object.keys(translation)
		.filter((key: string): boolean => !(key in source))
		.map((key: string): string => `${at(key)}: is not in English`);
	const compared = Object.entries(source).flatMap(([key, entry]): readonly string[] => {
		const translated = translation[key];
		return translated === undefined ? [`${at(key)}: is missing`] : entryIssues(at(key), entry, translated);
	});
	return [...compared, ...extra];
}

/** Every message of a catalogue, as `path → message`, for coverage checks (how much of it is translated). */
export function catalogMessages(catalog: MessageCatalog, path = ""): ReadonlyMap<string, string> {
	const messages = new Map<string, string>();
	for (const [key, entry] of Object.entries(catalog)) {
		const at = path.length === 0 ? key : `${path}.${key}`;
		const text = z.string().safeParse(entry);
		const list = MessageListSchema.safeParse(entry);
		const group = MessageCatalogSchema.safeParse(entry);
		if (text.success) {
			messages.set(at, text.data);
		} else if (list.success) {
			list.data.forEach((item: string, index: number): void => {
				messages.set(`${at}[${String(index)}]`, item);
			});
		} else if (group.success) {
			for (const [nested, message] of catalogMessages(group.data, at)) {
				messages.set(nested, message);
			}
		}
	}
	return messages;
}
