import Image from "next/image";

import { BookOpen, Clock, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocContent } from "@/lib/docs";
import { formatIsoDate } from "@/lib/markdown";

/**
 * DocBanner — the cover banner shown at the top of every `/docs/<slug>` page.
 * Purely presentational (rules 9–11): it receives the whole `DocContent` via
 * props and renders whatever cover art the smart layer gave it.
 *
 * The cover is a real photograph sourced from the guide's `coverImage`
 * frontmatter (an absolute https URL), rendered through `next/image` with a
 * subtle left-to-right scrim so the light title stays legible over any photo.
 * When a guide has no `coverImage`, the banner falls back to a clean neutral
 * panel — no decorative gradients anywhere.
 *
 * ## Typography
 * Kept deliberately restrained (the "AI-ish" look comes from heavy bold
 * headings, tight letter-spacing eyebrows, and high-contrast scrims):
 * - a small pill **eyebrow chip** instead of a letter-spaced uppercase label,
 * - a `font-semibold tracking-tight text-balance` title (no `font-bold`),
 * - body-copy description at `15px`,
 * - a **top-divided meta row** so author / updated / read-time read as a
 *   structured footer rather than a floating list of chips.
 */

export interface DocBannerProps {
	readonly doc: DocContent;
	readonly className?: string;
}

export function DocBanner({ doc, className }: DocBannerProps): React.JSX.Element {
	const coverUrl = doc.coverImage;
	const hasCover = coverUrl !== undefined && coverUrl.length > 0;

	return (
		<header className={cn("relative overflow-hidden rounded-2xl border border-border/60 shadow-sm", className)}>
			{hasCover ? (
				<>
					{/* Real photograph, cropped to cover the banner */}
					<Image src={coverUrl} alt="" fill priority sizes="(min-width: 1024px) 1152px, 100vw" className="object-cover" />
					{/* Legibility scrim — a light left-to-right darkening so the title stays readable over any photo */}
					<div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-black/65 via-black/35 to-black/10" />
				</>
			) : (
				<div aria-hidden="true" className="absolute inset-0 bg-muted" />
			)}

			<div className="relative px-6 py-10 sm:px-10 sm:py-12">
				{/* Eyebrow — a quiet pill chip, not a letter-spaced label */}
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase",
						hasCover ? "border-white/20 bg-white/10 text-white/90 backdrop-blur-sm" : "border-border bg-background/60 text-muted-foreground",
					)}>
					<span aria-hidden="true" className={cn("size-1.5 rounded-full", hasCover ? "bg-white/70" : "bg-muted-foreground/60")} />
					Guide
				</span>

				<h1 className={cn("mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl", hasCover ? "text-white" : "text-foreground")}>{doc.title}</h1>

				{doc.description.length > 0 ? (
					<p className={cn("mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px]", hasCover ? "text-white/85" : "text-muted-foreground")}>{doc.description}</p>
				) : null}

				{/* Meta — top divider turns the row into a structured footer */}
				<div
					className={cn(
						"mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-4 text-xs",
						hasCover ? "border-white/15 text-white/75" : "border-border text-muted-foreground",
					)}>
					{doc.author !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<PenLine className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
							{doc.author}
						</span>
					) : null}
					{doc.lastUpdated !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<Clock className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
							Updated {formatIsoDate(doc.lastUpdated)}
						</span>
					) : null}
					<span className="inline-flex items-center gap-1.5">
						<BookOpen className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
						{doc.readingTimeMinutes} min read
					</span>
				</div>
			</div>
		</header>
	);
}
