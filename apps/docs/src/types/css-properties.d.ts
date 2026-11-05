import "react";

/** The CSS custom properties the docs set from React (`style`), declared so they type-check without a cast. */
declare module "react" {
	interface CSSProperties {
		/** How much of a timeline track is filled (`.toc-timeline` in src/styles/app.css). */
		readonly "--toc-fill"?: string;
	}
}
