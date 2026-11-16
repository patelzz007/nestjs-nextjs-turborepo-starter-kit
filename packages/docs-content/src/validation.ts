import type { DocsSyncIssue } from "@workspace/shared";

import type { SourceDocumentMeta } from "./document.ts";
import { filePathFor, isSafeSlug } from "./slug.ts";

/**
 * The publishing rules (plan §3 and §8), the same for every source. A page-level issue holds that page back; a
 * workspace-level one stops the batch, because it means two pages disagree and no single page is at fault.
 */

function pageIssue(reason: string, fix: string): DocsSyncIssue {
	return { blockId: null, blockType: null, reason, fix };
}

/** What stops this one document from publishing: the source's own findings first, then the shared rules. */
export function documentIssues(meta: SourceDocumentMeta): readonly DocsSyncIssue[] {
	const issues: DocsSyncIssue[] = [...meta.issues];
	if (meta.title.length === 0) {
		issues.push(pageIssue("The page has no title.", "Give the page a title."));
	}
	if (meta.slug === null || meta.slug.length === 0) {
		// A source that left the slug null with a reason has already said what to fix.
		if (meta.issues.length === 0) {
			issues.push(pageIssue("The page has no slug.", "Fill in the Slug property; it becomes the page's address."));
		}
	} else if (!isSafeSlug(meta.slug, meta.collection)) {
		issues.push(pageIssue(`The slug "${meta.slug}" cannot be used.`, "Use letters, digits, dashes and dots, separated by /, and avoid the reserved folders."));
	}
	if (meta.description === null) {
		issues.push(pageIssue("The page has no description.", "Fill in the Description property; search and sharing show it."));
	}
	if (meta.category === null) {
		issues.push(pageIssue("The page has no category.", "Choose a Category."));
	}
	if (meta.publishedAt === null) {
		issues.push(pageIssue("The page has no publish date.", "Fill in the Date property: when the page was first published."));
	}
	if (meta.lastUpdated === null) {
		issues.push(pageIssue("The page has no last-updated date.", "Fill in Last updated: when the page last changed in a way a reader should know about."));
	}
	return meta.collection === "blog" ? [...issues, ...postIssues(meta)] : [...issues, ...guideIssues(meta)];
}

function guideIssues(meta: SourceDocumentMeta): readonly DocsSyncIssue[] {
	const issues: DocsSyncIssue[] = [];
	if (meta.section === null) {
		issues.push(pageIssue("The page has no section.", "Choose a Section; it places the page in the sidebar."));
	}
	if (meta.order === null) {
		issues.push(pageIssue("The page has no order.", "Fill in Order with a whole number above zero."));
	}
	return issues;
}

function postIssues(meta: SourceDocumentMeta): readonly DocsSyncIssue[] {
	const issues: DocsSyncIssue[] = [];
	if (meta.author === null) {
		issues.push(pageIssue("The post has no author.", "Fill in the Author property."));
	}
	if (meta.cover === null) {
		issues.push(pageIssue("The post has no cover.", "Add a page cover: posts are what people share."));
	}
	return issues;
}

/** What stops the whole batch: two documents after one file. */
export function workspaceProblems(documents: readonly SourceDocumentMeta[]): readonly string[] {
	const owners = new Map<string, string>();
	return documents.flatMap((meta): string[] => {
		if (meta.slug === null || !isSafeSlug(meta.slug, meta.collection)) {
			return [];
		}
		const path = filePathFor(meta.slug, meta.collection).toLowerCase();
		const owner = owners.get(path);
		owners.set(path, meta.sourceId);
		return owner === undefined ? [] : [`The slug "${meta.slug}" is used by both ${owner} and ${meta.sourceId}.`];
	});
}
