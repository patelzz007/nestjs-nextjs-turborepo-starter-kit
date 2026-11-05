import { Link } from "@tanstack/react-router";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Kbd } from "@workspace/ui/components/kbd";
import { Search } from "lucide-react";
import type { ReactElement } from "react";

import type { LearningCenter } from "@/lib/content";
import { coverThumbnail } from "@/lib/cover-thumbnail";
import { sectionSlug, type NavItem } from "@/lib/navigation";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

import { DocsIcon } from "./docs-icon";
import { SpriteIcon } from "./icon-sprite";
import { useOpenSearch } from "./search-provider";

/**
 * Card thumbnails: a wide strip (~2.2:1), so 205 guides stay scannable; at most ~400px wide on screen, so
 * 640 × 290 stays sharp on dense displays.
 */
const CARD_WIDTH = 640;
const CARD_HEIGHT = 290;
const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT;
/** The hero's picture grid: the first guides of the first section, one tall tile beside two short ones. */
const HERO_TILES = 3;
/** Where each hero tile sits in the 2 × 2 grid: the first spans both rows. */
const HERO_TILE_PLACEMENT: readonly string[] = ["row-span-2", "", ""];
/** Hero tiles are at most ~260px wide on screen; 520 × 520 covers the tall tile at 2× and crops cleanly. */
const HERO_TILE_SIZE = 520;
/** `sizes` for a card's thumbnail: one column on phones, two from 768px, three from 1280px. */
const CARD_SIZES = "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw";

export interface LearningCenterViewProps {
	readonly center: LearningCenter;
}

interface GuideCardProps {
	readonly item: NavItem;
	readonly center: LearningCenter;
}

/**
 * One guide: its cover, its icon over the cover's edge, title, summary and first sections. The page lists all
 * 205 guides, so the icon comes from the page's sprite and the section pills share one class (`.docs-pill`).
 */
function GuideCard({ item, center }: GuideCardProps): ReactElement {
	const cover = center.covers[item.id];
	const quickLinks = center.quickLinks[item.id] ?? [];
	return (
		<li className="group relative grid content-start gap-3 rounded-xl border border-border bg-(--docs-chrome) p-3 transition-colors focus-within:border-(--docs-link) hover:border-(--docs-link)">
			<div className="relative">
				<CoverImage src={cover === undefined ? null : coverThumbnail(cover, CARD_WIDTH, CARD_HEIGHT)} ratio={CARD_RATIO} sizes={CARD_SIZES} className="rounded-lg" />
				<IconTile variant="elevated" tone="neutral" size="md" className="absolute -bottom-4 left-3">
					<span className="text-(--docs-link)">
						<SpriteIcon name={item.icon} size={18} />
					</span>
				</IconTile>
			</div>
			<div className="grid min-w-0 gap-1 px-1 pt-3">
				<Link
					to="/docs/$"
					params={{ _splat: item.id }}
					className="font-semibold text-foreground group-hover:text-(--docs-link) after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
					{item.title}
				</Link>
				{item.description.length > 0 ? <p className="text-sm text-(--docs-text-secondary)">{item.description}</p> : null}
				{quickLinks.length > 0 ? (
					<ul aria-label={`${item.title}: sections`} className="relative mt-2 flex flex-wrap gap-1.5 text-xs">
						{quickLinks.map((link) => (
							<li key={link.slug}>
								<Link to="/docs/$" params={{ _splat: item.id }} hash={link.slug} className="docs-pill">
									{link.text}
								</Link>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</li>
	);
}

/** The home page and `/docs`: a hero with the first guides' covers as a picture grid, then every section of `docs/meta.json` as cover cards. */
export function LearningCenterView({ center }: LearningCenterViewProps): ReactElement {
	const openSearch = useOpenSearch();
	const [firstSection] = center.sections;
	const heroTiles = (firstSection?.items ?? []).slice(0, HERO_TILES);
	return (
		<main id="main-content" className="mx-auto max-w-10xl px-4 pt-10 pb-20 md:px-6">
			<header className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
				<div className="grid max-w-3xl gap-4">
					<p className="font-mono text-xs text-muted-foreground">docs/</p>
					<h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">{SITE_TITLE}</h1>
					<p className="text-lg leading-relaxed text-(--docs-text-secondary)">{SITE_DESCRIPTION}</p>
					<button
						type="button"
						onClick={openSearch}
						className="mt-2 flex h-11 max-w-xl items-center gap-3 rounded-lg border border-border bg-(--docs-chrome) px-4 text-left text-sm text-muted-foreground transition-colors hover:border-(--docs-link) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
						<Search aria-hidden="true" className="size-4" />
						Search every guide, heading and post
						<Kbd className="ms-auto">⌘K</Kbd>
					</button>
				</div>
				{heroTiles.length > 0 ? (
					<ul aria-label="Start here" className="hidden h-72 grid-cols-[3fr_2fr] grid-rows-2 gap-3 lg:grid">
						{heroTiles.map((item, index) => {
							const cover = center.covers[item.id];
							return (
								<li key={item.id} className={`min-h-0 ${HERO_TILE_PLACEMENT[index] ?? ""}`}>
									<Link
										to="/docs/$"
										params={{ _splat: item.id }}
										className="group/tile relative block size-full overflow-hidden rounded-xl border border-border bg-(--docs-chrome) transition-colors hover:border-(--docs-link) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
										{cover === undefined ? null : (
											<img
												src={coverThumbnail(cover, HERO_TILE_SIZE, HERO_TILE_SIZE)}
												alt=""
												width={HERO_TILE_SIZE}
												height={HERO_TILE_SIZE}
												decoding="async"
												className="size-full object-cover"
											/>
										)}
										<span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg border border-border bg-(--docs-chrome) px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors group-hover/tile:text-(--docs-link)">
											<DocsIcon name={item.icon} size={14} className="shrink-0 text-(--docs-link)" />
											<span className="truncate">{item.title}</span>
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				) : null}
			</header>
			<nav aria-label="Sections" className="mt-10 flex flex-wrap gap-2">
				{center.sections.map((section) => (
					<a
						key={section.title}
						href={`#${sectionSlug(section.title)}`}
						className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-(--docs-text-secondary) transition-colors hover:border-(--docs-link) hover:text-foreground">
						<DocsIcon name={section.icon} size={14} />
						{section.title}
					</a>
				))}
			</nav>
			<div className="mt-12 grid gap-14">
				{center.sections.map((section) => (
					<section key={section.title} id={sectionSlug(section.title)} aria-labelledby={`${sectionSlug(section.title)}-title`} className="scroll-mt-24">
						<h2 id={`${sectionSlug(section.title)}-title`} className="flex items-center gap-2 border-b border-border pb-3 text-xl font-semibold tracking-tight">
							<DocsIcon name={section.icon} size={18} className="text-(--docs-link)" />
							{section.title}
							<span className="ms-auto font-mono text-xs font-normal text-muted-foreground">{section.items.length} guides</span>
						</h2>
						<ul className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
							{section.items.map((item) => (
								<GuideCard key={item.id} item={item} center={center} />
							))}
						</ul>
					</section>
				))}
			</div>
		</main>
	);
}
