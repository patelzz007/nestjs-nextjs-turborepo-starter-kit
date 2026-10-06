/**
 * Copy interfaces of the navigation label families (`breadcrumbTrail`,
 * `carousel` in `UiKitLabels`; `breadcrumb` and `pagination` are defined in
 * `lib/labels/ui-kit-labels.ts`). The strings themselves live in the language
 * packs (`lib/labels/en.ts`, …); components read them with `useUiKitLabels`.
 */

/** Copy for `BreadcrumbTrail`'s status states, collapse popover and copy-link action. */
export interface BreadcrumbTrailLabels {
	/** Error-state message (the trail's `errorMessage` prop still wins). */
	readonly errorMessage: string;
	readonly retry: string;
	readonly copyLink: string;
	/** Tooltip after a failed copy. */
	readonly copyLinkFailedTitle: string;
	/** Polite live-region announcements after a copy attempt. */
	readonly linkCopied: string;
	readonly copyFailed: string;
	readonly moreBreadcrumbsAriaLabel: string;
	readonly showAllBreadcrumbsTitle: string;
}

/** Copy for `Carousel`: the region/slide role descriptions and the arrow buttons. */
export interface CarouselLabels {
	readonly carouselRoleDescription: string;
	readonly slideRoleDescription: string;
	readonly previousSlide: string;
	readonly nextSlide: string;
}
