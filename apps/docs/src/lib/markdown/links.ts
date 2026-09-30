import { posix } from "node:path";

import type { Link, Root } from "mdast";
import { visit } from "unist-util-visit";

import { contentId } from "../navigation";

/**
 * Cross-file links. Guides are written to read well on GitHub, so they link
 * to each other with relative paths (`./prisma.md#10-row-level-security`,
 * `../apps/api/src/...`). On the site those become:
 *
 * - another guide under `docs/`     → `/docs/<id>#anchor`
 * - a post under `blog/`            → `/blog/<id>#anchor`
 * - anything else in the repository → the file on GitHub
 *
 * Heading anchors survive unchanged: Astro and GitHub both slug headings with
 * `github-slugger`.
 */
export interface ContentRoots {
	/** Absolute path of the repository root (forward slashes). */
	readonly repoRoot: string;
	/** `https://github.com/<owner>/<repo>/blob/<branch>` */
	readonly githubBlobBase: string;
}

/** The parts of a VFile this plugin reads. */
interface SourceFile {
	readonly path?: string | undefined;
}

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function toPosix(filePath: string): string {
	return filePath.replace(/\\/g, "/");
}

function splitSuffix(href: string): { readonly target: string; readonly suffix: string } {
	const index = href.search(/[?#]/);
	return index < 0 ? { target: href, suffix: "" } : { target: href.slice(0, index), suffix: href.slice(index) };
}

/** Rewrites a relative link found in `fromFile`; absolute, external and in-page links are returned unchanged. */
export function resolveContentLink(href: string, fromFile: string, roots: ContentRoots): string {
	if (href.length === 0 || href.startsWith("#") || href.startsWith("/") || SCHEME_PATTERN.test(href)) {
		return href;
	}
	const { target, suffix } = splitSuffix(href);
	const repoRoot = toPosix(roots.repoRoot).replace(/\/+$/, "");
	const absolute = posix.resolve(posix.dirname(toPosix(fromFile)), target);
	const relative = posix.relative(repoRoot, absolute);
	if (relative.startsWith("..") || posix.isAbsolute(relative)) {
		return href;
	}
	const isMarkdown = /\.mdx?$/.test(relative);
	if (isMarkdown && relative.startsWith("docs/")) {
		return `/docs/${contentId(relative.slice("docs/".length))}${suffix}`;
	}
	if (isMarkdown && relative.startsWith("blog/")) {
		return `/blog/${contentId(relative.slice("blog/".length))}${suffix}`;
	}
	if (relative.startsWith("docs/images/")) {
		return `/${relative.slice("docs/".length)}${suffix}`;
	}
	return `${roots.githubBlobBase}/${relative}${suffix}`;
}

/** Remark plugin applying {@link resolveContentLink} to every link in a file. */
export function remarkContentLinks(roots: ContentRoots): (tree: Root, file: SourceFile) => void {
	return (tree: Root, file: SourceFile): void => {
		const fromFile = file.path;
		if (fromFile === undefined || fromFile.length === 0) {
			return;
		}
		visit(tree, "link", (node: Link) => {
			node.url = resolveContentLink(node.url, fromFile, roots);
		});
	};
}
