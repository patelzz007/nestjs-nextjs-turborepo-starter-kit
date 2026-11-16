import type { DocsSourceKind } from "@workspace/docs-content/document";
import { z } from "zod";

import { LIVE_DOWNLOAD_ENVIRONMENT } from "../locked-download.ts";
import type { DocsSource } from "../source.ts";
import { LIVE_NOTION_ENVIRONMENT, NotionClient } from "./notion/notion-client.ts";
import { NotionSource } from "./notion/notion-source.ts";

/**
 * The one place a tool is chosen. To add Obsidian or Inkdrop: add its value to `DocsSourceKindSchema`, its folder
 * under `sources/`, and an entry in `SOURCE_FACTORIES`. The compiler refuses a kind with no entry.
 */

type Environment = Readonly<Record<string, string | undefined>>;

const NotionEnvironmentSchema = z.object({
	NOTION_READ_TOKEN: z.string().min(1),
	NOTION_DOCS_DATA_SOURCE_ID: z.string().min(1),
	NOTION_BLOG_DATA_SOURCE_ID: z.string().min(1),
});

/** A variable a source needs is missing. Names only: never a value. */
export class SourceConfigurationError extends Error {
	public constructor(kind: DocsSourceKind, missing: readonly string[]) {
		super(`The ${kind} source needs these environment variables: ${missing.join(", ")}`);
		this.name = "SourceConfigurationError";
	}
}

function notionSource(environment: Environment): DocsSource {
	const parsed = NotionEnvironmentSchema.safeParse(environment);
	if (!parsed.success) {
		throw new SourceConfigurationError(
			"NOTION",
			parsed.error.issues.map((issue) => String(issue.path.at(0))),
		);
	}
	const { NOTION_READ_TOKEN: token, NOTION_DOCS_DATA_SOURCE_ID: docs, NOTION_BLOG_DATA_SOURCE_ID: blog } = parsed.data;
	return new NotionSource(new NotionClient(token, LIVE_NOTION_ENVIRONMENT), { docs, blog }, LIVE_DOWNLOAD_ENVIRONMENT);
}

const SOURCE_FACTORIES: Readonly<Record<DocsSourceKind, (environment: Environment) => DocsSource>> = {
	NOTION: notionSource,
};

/** The source of `kind`, configured from the environment. */
export function createSource(kind: DocsSourceKind, environment: Environment): DocsSource {
	return SOURCE_FACTORIES[kind](environment);
}
