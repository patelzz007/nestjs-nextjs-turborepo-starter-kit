import type { MDXComponents } from "mdx/types";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { Callout } from "@/components/callout";
import { CodeBlockWithWrap } from "@/components/code-block-wrap";
import { DocsImage } from "@/components/docs-image";
import { ImageGallery } from "@/components/image-gallery";
import { MermaidDiagram } from "@/components/mermaid";
import { ProseLink } from "@/components/prose-link";
import { ProseHeading } from "@/components/prose-heading";
import { DocsTable, DocsTd, DocsTh } from "@/components/prose-table";
import { ProseEm, ProseHr, ProseInput, ProseLi, ProseOl, ProseParagraph, ProseStrong, ProseUl } from "@/components/prose-inline";

/**
 * Global MDX components — merged over `fumadocs-ui`'s defaults so the docs
 * render with the ported design system (callouts, the official Fumadocs
 * CodeBlock, mermaid, image galleries + lightbox, and the admin's prose
 * typography). The components are discovered by the fumadocs MDX compiler via
 * the `useMDXComponents` convention.
 *
 * Fenced code blocks are highlighted by Fumadocs' rehype-code at build time;
 * the resulting `<pre>` renders through the official `CodeBlock` (copy button
 * + optional title bar) that `fumadocs-ui/mdx` maps as its `pre` default — the
 * same component `npx @fumadocs/cli@latest add codeblock` installs a copy of.
 * Inline `<code>` is left as plain markup and styled via CSS
 * (`.prose code:not(pre code)`) so it never clashes with the highlighted
 * block output inside `<pre>`.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		// Custom components emitted by the remark plugins.
		Callout,
		Mermaid: MermaidDiagram,
		ImageGallery,
		// Official Fumadocs CodeBlock + a word-wrap toggle in the action bar.
		pre: CodeBlockWithWrap,
		// Element overrides.
		img: DocsImage,
		a: ProseLink,
		h2: (props) => <ProseHeading tag="h2" {...props} />,
		h3: (props) => <ProseHeading tag="h3" {...props} />,
		h4: (props) => <ProseHeading tag="h4" {...props} />,
		p: ProseParagraph,
		strong: ProseStrong,
		em: ProseEm,
		ul: ProseUl,
		ol: ProseOl,
		li: ProseLi,
		hr: ProseHr,
		input: ProseInput,
		table: DocsTable,
		thead: (props) => <thead {...props} />,
		tbody: (props) => <tbody {...props} />,
		tr: (props) => <tr {...props} />,
		th: DocsTh,
		td: DocsTd,
		...components,
	};
}

export const useMDXComponents = getMDXComponents;
