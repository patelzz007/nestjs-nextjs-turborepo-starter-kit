import { preloadCodeBlockHighlighter } from "@workspace/ui/components/code-block-highlight";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";
import { VFile } from "vfile";

import { DOCS_CODE_BLOCK_THEMES } from "./code-block/themes";
import { rehypeCalloutAlert } from "./markdown/callout-alert";
import { rehypeCodeBlock } from "./markdown/code-block";
import { rehypeHeadingIds, type RenderedHeading } from "./markdown/heading-ids";
import { remarkContentLinks, type ContentRoots } from "./markdown/links";
import { remarkMediaEmbeds } from "./markdown/media-embeds";
import { remarkPdfEmbed } from "./markdown/pdf-embed";
import { remarkQrCode } from "./markdown/qr-code";
import { rehypeExternalLinks, rehypeHeadingAnchors, rehypeTableWrapper } from "./markdown/rehype-plugins";
import { remarkCallouts, remarkDiagrams, remarkGlossary, remarkImageGallery, remarkImageUrls, remarkStripFirstHeading, remarkTaskMarkers } from "./markdown/remark-plugins";

export type { ContentRoots } from "./markdown/links";
export type { RenderedHeading } from "./markdown/heading-ids";

/** One Markdown file rendered for the site. */
export interface RenderedMarkdown {
	/** The page body as HTML (code blocks and media embeds carry their island markup and props). */
	readonly html: string;
	/** Every heading in document order, with the anchor id it was given. */
	readonly headings: readonly RenderedHeading[];
}

/** Renders one Markdown body; `filePath` (absolute) is what relative links resolve against. */
export type MarkdownRenderer = (markdown: string, filePath: string) => Promise<RenderedMarkdown>;

/**
 * Builds the docs' Markdown → HTML pipeline. The order is the one the site used under Astro (Astro's own
 * defaults first: GitHub-flavoured Markdown and SmartyPants, then the site's plugins), so the HTML and
 * every heading anchor stay the same:
 *
 * - remark: links/images are rewritten before galleries and callouts; diagram, QR, PDF and media fences
 *   leave the tree before `rehypeCodeBlock` sees the rest.
 * - rehype: heading ids first (permalinks reference them), then links and tables, then fences become the
 *   shared CodeBlock, and callouts the shared Alert.
 *
 * The code-block highlighter is loaded up front: it lazy-imports Shiki and each grammar, and a block whose
 * grammar failed to load would otherwise ship uncoloured (`rehypeCodeBlock` throws instead).
 */
export async function createMarkdownRenderer(roots: ContentRoots): Promise<MarkdownRenderer> {
	await preloadCodeBlockHighlighter({ themes: DOCS_CODE_BLOCK_THEMES });
	const processor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkSmartypants)
		.use(remarkContentLinks, roots)
		.use(remarkStripFirstHeading)
		.use(remarkDiagrams)
		.use(remarkQrCode)
		.use(remarkPdfEmbed)
		.use(remarkMediaEmbeds)
		.use(remarkImageUrls)
		.use(remarkImageGallery)
		.use(remarkTaskMarkers)
		.use(remarkCallouts)
		.use(remarkGlossary)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeHeadingIds)
		.use(rehypeHeadingAnchors)
		.use(rehypeExternalLinks)
		.use(rehypeTableWrapper)
		.use(rehypeCodeBlock)
		.use(rehypeCalloutAlert)
		.use(rehypeRaw)
		.use(rehypeStringify, { allowDangerousHtml: true });

	return async (markdown: string, filePath: string): Promise<RenderedMarkdown> => {
		const file = new VFile({ value: markdown, path: filePath });
		const output = await processor.process(file);
		return { html: String(output), headings: output.data.headings ?? [] };
	};
}
