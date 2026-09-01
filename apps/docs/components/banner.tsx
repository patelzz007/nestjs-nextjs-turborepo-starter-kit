import Image from "next/image";
import { CalendarDays, Clock, User } from "lucide-react";

import { formatEpochDate } from "@/lib/dates";

/**
 * DocBanner — the article header block: an optional cover-image banner
 * (frontmatter `coverImage`, e.g. Unsplash art), plus a quiet meta row with
 * the author, the git-derived `lastUpdated` date (rendered via date-fns) and
 * the reading time in minutes.
 */
export interface DocBannerProps {
	readonly coverImage?: string;
	readonly author?: string;
	readonly lastUpdated?: number;
	readonly readingMinutes?: number;
}

export function DocBanner({ coverImage, author, lastUpdated, readingMinutes }: DocBannerProps): React.JSX.Element {
	return (
		<div className="mb-6">
			{coverImage !== undefined ? (
				<div className="bg-dot-grid border-fd-border/60 bg-fd-muted/30 relative mb-5 h-44 w-full overflow-hidden rounded-2xl border sm:h-56">
					<Image src={coverImage} alt="" fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
					<div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
				</div>
			) : null}
			{author !== undefined || lastUpdated !== undefined || readingMinutes !== undefined ? (
				<div className="text-fd-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
					{author !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<User className="size-3.5" />
							{author}
						</span>
					) : null}
					{lastUpdated !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<CalendarDays className="size-3.5" />
							Updated {formatEpochDate(lastUpdated)}
						</span>
					) : null}
					{readingMinutes !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<Clock className="size-3.5" />
							{readingMinutes} min read
						</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}
