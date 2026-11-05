import { extractEndpointAccess, type ControllerSource } from "@workspace/docs-renderer/api-reference/endpoint-access";
import { buildEndpointIndex, type EndpointRow } from "@workspace/docs-renderer/api-reference/endpoint-index";
import { OpenApiDocumentSchema } from "@workspace/docs-renderer/api-reference/openapi";
import { createMarkdownRenderer } from "@workspace/docs-renderer/pipeline";

import rawBlogMeta from "../../../../blog/meta.json";
import rawDocsMeta from "../../../../docs/meta.json";
import { imageRouteParam } from "../lib/assets";
import { BlogMetaSchema } from "../lib/blog";
import { createContentStore, type ContentFiles, type ContentStore } from "../lib/content";
import { DocsMetaSchema } from "../lib/navigation";
import { GITHUB_BRANCH, GITHUB_URL } from "../lib/site";

/**
 * The site's content, server-only (the `.server.ts` suffix keeps it out of the browser bundle). The
 * repo-root `docs/` and `blog/` folders are the single source of truth; Vite's glob reads them at build
 * time, so a change to any guide rebuilds the pages that show it, and the dev server reloads on edit.
 */
const DOCS_FILES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../../docs/**/*.md", { query: "?raw", import: "default", eager: true });
const BLOG_FILES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../../blog/**/*.md", { query: "?raw", import: "default", eager: true });
/** `docs/images/` is served at `/images/…`, so guides use paths that also work on GitHub. */
const IMAGE_FILES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../../docs/images/**/*.{png,jpg,jpeg,gif,webp,avif,svg}", {
	query: "?inline",
	import: "default",
	eager: true,
});
const OPENAPI_FILES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../../docs/generated/openapi.json", { query: "?raw", import: "default", eager: true });
const CONTROLLER_FILES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../api/src/**/*.controller.ts", { query: "?raw", import: "default", eager: true });
const RATE_LIMIT_POLICY_FILES: Readonly<Record<string, string>> = import.meta.glob<string>(
	"../../../api/src/platform/presentation/http/security/throttling/rate-limit-policy.ts",
	{
		query: "?raw",
		import: "default",
		eager: true,
	},
);

/** Relative links resolve by path arithmetic only, so any root works; this one names no machine. */
const VIRTUAL_REPO_ROOT = "/repo";

/** `files` re-keyed by their path below `marker` (`../../../../docs/x.md` → `x.md`). */
export function relativeTo(marker: string, files: Readonly<Record<string, string>>): ContentFiles {
	return Object.fromEntries(
		Object.entries(files).flatMap(([key, value]): [string, string][] => {
			const index = key.indexOf(marker);
			return index < 0 ? [] : [[key.slice(index + marker.length), value]];
		}),
	);
}

let storePromise: Promise<ContentStore> | undefined;

/** The content store, built once per server process. */
export function contentStore(): Promise<ContentStore> {
	storePromise ??= createMarkdownRenderer({ repoRoot: VIRTUAL_REPO_ROOT, githubBlobBase: `${GITHUB_URL}/blob/${GITHUB_BRANCH}` }).then((render) =>
		createContentStore({
			docs: relativeTo("/docs/", DOCS_FILES),
			blog: relativeTo("/blog/", BLOG_FILES),
			docsMeta: DocsMetaSchema.parse(rawDocsMeta),
			blogMeta: BlogMetaSchema.parse(rawBlogMeta),
			render,
			repoRoot: VIRTUAL_REPO_ROOT,
		}),
	);
	return storePromise;
}

/** The data URL of `/images/<path>`, or `null` when there is no such image. */
export function imageDataUrl(imagePath: string): string | null {
	const [, dataUrl = null] = Object.entries(IMAGE_FILES).find(([key]) => imageRouteParam(key) === imagePath) ?? [];
	return dataUrl;
}

function onlyFile(files: Readonly<Record<string, string>>, what: string): string {
	const [content, ...others] = Object.values(files);
	if (content === undefined || others.length > 0) {
		throw new Error(`Expected exactly one ${what}.`);
	}
	return content;
}

let endpoints: readonly EndpointRow[] | undefined;

/** Every API operation for the endpoint explorer, from the OpenAPI export and the controllers' decorators. */
export function endpointIndex(): readonly EndpointRow[] {
	if (endpoints === undefined) {
		const document = OpenApiDocumentSchema.parse(JSON.parse(onlyFile(OPENAPI_FILES, "OpenAPI export (docs/generated/openapi.json)")));
		const controllers = Object.entries(relativeTo("/api/src/", CONTROLLER_FILES))
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([file, source]): ControllerSource => ({ path: `apps/api/src/${file}`, source }));
		endpoints = buildEndpointIndex(document, extractEndpointAccess(controllers, onlyFile(RATE_LIMIT_POLICY_FILES, "rate-limit policy file")));
	}
	return endpoints;
}
