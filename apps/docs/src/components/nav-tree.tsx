import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { sectionSlug, type SidebarSection } from "@/lib/navigation";

import { SpriteIcon } from "./icon-sprite";

export interface NavTreeProps {
	readonly sections: readonly SidebarSection[];
	/** The current guide's id (highlighted), `null` on pages that are not a guide. */
	readonly activeId: string | null;
	/** Called after a guide is picked (the phone drawer closes itself). */
	readonly onNavigate?: () => void;
}

/**
 * The guide tree, by `docs/meta.json` section: the sidebar from 1024px up and the phone drawer below.
 * The current guide is a solid pill; hover is a soft wash, so the two never look alike. Long titles wrap
 * rather than being cut off, so every guide's full name is readable in the narrow sidebar. Every page
 * carries the tree, so its styles live in one class (`.docs-nav-link`, src/styles/app.css), not on each link.
 */
export function NavTree({ sections, activeId, onNavigate }: NavTreeProps): ReactElement {
	return (
		<nav aria-label="Guides" className="grid min-w-0 gap-6 text-sm">
			{sections.map((section) => (
				<div key={section.title} className="grid min-w-0 gap-1">
					<p id={`nav-${sectionSlug(section.title)}`} className="flex items-center gap-2 px-2.5 text-[0.8125rem] font-medium text-muted-foreground">
						{section.title}
					</p>
					<ul aria-labelledby={`nav-${sectionSlug(section.title)}`} className="grid min-w-0 gap-px">
						{section.items.map((item) => {
							const isActive = item.id === activeId;
							return (
								<li key={item.id}>
									<Link to="/docs/$" params={{ _splat: item.id }} aria-current={isActive ? "page" : undefined} onClick={onNavigate} className="docs-nav-link">
										<SpriteIcon name={item.icon} size={15} />
										<span>{item.title}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}
