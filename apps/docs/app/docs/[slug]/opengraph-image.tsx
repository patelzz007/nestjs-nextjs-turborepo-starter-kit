import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

import { BASE_URL, SITE_NAME } from "@/lib/site";
import { source } from "@/lib/source";

/**
 * Automatic Open Graph image for every guide under `/docs/…`.
 *
 * The card is rendered from the page's own frontmatter (title, description)
 * plus the section it belongs to (derived from the sidebar `meta.json`
 * separators), so a brand-new doc gets a consistent share preview with zero
 * extra work — no per-page `coverImage` needed for social cards. The cover
 * image remains the in-page banner art.
 *
 * Fonts are read once at module scope (build/runtime is the `apps/docs`
 * directory, so `process.cwd()/fonts` resolves the committed TTFs) — see the
 * Next.js docs on Node.js runtime + local assets for this pattern.
 */

// ── Static route metadata (used for the generated <meta> tags) ─────────────
export const alt = `${SITE_NAME} — guide preview`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Fonts (Geist body + Space Grotesk headings, matching the app shell) ──
const regularFont = readFile(join(process.cwd(), "fonts", "Geist-Regular.ttf"));
const boldFont = readFile(join(process.cwd(), "fonts", "Geist-Bold.ttf"));
// Space Grotesk (static 400/700 WOFF from Fontsource) — satori can't parse
// the variable TTF, so the two weights are registered separately.
const headingRegularFont = readFile(join(process.cwd(), "fonts", "SpaceGrotesk-Regular.woff"));
const headingBoldFont = readFile(join(process.cwd(), "fonts", "SpaceGrotesk-Bold.woff"));

// ── Palette (the docs brand: dark slate + white, no fancy gradients) ───────
const BG_TOP = "#0b1220"; // slate-950-ish
const BG_BOTTOM = "#16233b"; // slate-900-ish
const TEXT_PRIMARY = "#f8fafc"; // slate-50
const TEXT_MUTED = "#94a3b8"; // slate-400
const TEXT_FAINT = "#64748b"; // slate-500
const ACCENT = "#e2e8f0"; // slate-200
const CHIP_BORDER = "rgba(148, 163, 184, 0.35)";
const GRID_DOT = "rgba(148, 163, 184, 0.18)";

/** One of the sidebar tree node shapes — `Separator` | `Folder` | `Item`. */
interface TreeLikeNode {
	readonly type: "separator" | "folder" | "page";
	readonly name?: string | ReactNode;
	readonly url?: string;
	readonly children?: readonly TreeLikeNode[];
}

/**
 * Walks the sidebar page tree and returns the section label (the nearest
 * `--- Section ---` separator) that contains `targetUrl`. Folders reset the
 * current section to the folder's own name for their children.
 */
function findSection(nodes: readonly TreeLikeNode[], targetUrl: string, inherited?: string): string | undefined {
	let current: string | undefined = inherited;
	for (const node of nodes) {
		if (node.type === "separator") {
			current = typeof node.name === "string" && node.name.length > 0 ? node.name : current;
		} else if (node.type === "page") {
			if (node.url === targetUrl) {
				return current;
			}
		} else {
			// `Folder` — the only remaining node type in the union.
			const folderName = typeof node.name === "string" && node.name.length > 0 ? node.name : current;
			const nested = findSection(node.children ?? [], targetUrl, folderName);
			if (nested !== undefined) {
				return nested;
			}
		}
	}
	return undefined;
}

/** Clamps a string to `max` characters, appending an ellipsis when cut. */
function clamp(text: string, max: number): string {
	const trimmed: string = text.trim().replace(/\s+/g, " ");
	return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** Format the page URL for the card footer, e.g. `docs.example.com/docs/x`. */
function displayUrl(pageUrl: string): string {
	return `${BASE_URL.replace(/^https?:\/\//, "")}${pageUrl}`;
}

interface DocsRouteParams {
	readonly slug: string;
}

export default async function Image({ params }: { readonly params: Promise<DocsRouteParams> }): Promise<ImageResponse> {
	const { slug } = await params;
	const page = source.getPage([slug]);

	const title: string = page?.data.title ?? SITE_NAME;
	const description: string = page?.data.description ?? "";
	const section: string | undefined = page !== undefined ? findSection(source.getPageTree().children, page.url) : undefined;
	const pageUrl: string = page?.url ?? "/docs";

	const sectionChip = section ?? "Documentation";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: BG_TOP,
				backgroundImage: `linear-gradient(160deg, ${BG_TOP} 0%, ${BG_BOTTOM} 100%)`,
				fontFamily: "Geist",
				color: TEXT_PRIMARY,
				padding: "72px 80px",
				position: "relative",
				overflow: "hidden",
			}}>
			{/* Subtle dot-grid texture (same motif as the in-page banner) */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `radial-gradient(circle, ${GRID_DOT} 1px, transparent 1px)`,
					backgroundSize: "28px 28px",
				}}
			/>

			{/* Top row: brand mark + section chip */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 14,
							backgroundColor: ACCENT,
							color: BG_TOP,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontWeight: 700,
							fontSize: 30,
						}}>
						M
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>{SITE_NAME}</span>
						<span style={{ fontSize: 18, color: TEXT_FAINT }}>Developer guides</span>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						border: `1px solid ${CHIP_BORDER}`,
						borderRadius: 999,
						padding: "10px 22px",
						fontSize: 20,
						color: TEXT_MUTED,
						backgroundColor: "rgba(11, 18, 32, 0.6)",
					}}>
					<span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: ACCENT }} />
					{sectionChip}
				</div>
			</div>

			{/* Middle: title + description */}
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 24 }}>
				<h1 style={{ fontSize: 62, fontWeight: 700, fontFamily: "Space Grotesk", lineHeight: 1.15, letterSpacing: "-0.02em", margin: 0, maxWidth: 920 }}>
					{clamp(title, 70)}
				</h1>
				{description.length > 0 ? <p style={{ fontSize: 28, lineHeight: 1.5, color: TEXT_MUTED, margin: 0, maxWidth: 880 }}>{clamp(description, 150)}</p> : null}
			</div>

			{/* Bottom row: canonical URL */}
			<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
				<div style={{ width: 36, height: 3, borderRadius: 999, backgroundColor: ACCENT }} />
				<span style={{ fontSize: 22, color: TEXT_FAINT }}>{displayUrl(pageUrl)}</span>
			</div>
		</div>,
		{
			...size,
			fonts: [
				{ name: "Geist", data: await regularFont, weight: 400, style: "normal" },
				{ name: "Geist", data: await boldFont, weight: 700, style: "normal" },
				{ name: "Space Grotesk", data: await headingRegularFont, weight: 400, style: "normal" },
				{ name: "Space Grotesk", data: await headingBoldFont, weight: 700, style: "normal" },
			],
		},
	);
}
