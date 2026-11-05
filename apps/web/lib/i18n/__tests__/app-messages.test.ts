import { catalogIssues, MessageCatalogSchema } from "@workspace/shared";
import { UI_KIT_LANGUAGES } from "@workspace/ui/lib/labels/language-packs";
import { describe, expect, it } from "vitest";

import { WEB_MESSAGES } from "../app-messages";

describe("the customer app's catalogues (ADR 076)", () => {
	it.each(UI_KIT_LANGUAGES)("%s has exactly English's keys, and every message parses with English's placeholders", (language) => {
		expect(catalogIssues(MessageCatalogSchema.parse(WEB_MESSAGES.en), MessageCatalogSchema.parse(WEB_MESSAGES[language]))).toStrictEqual([]);
	});
});
