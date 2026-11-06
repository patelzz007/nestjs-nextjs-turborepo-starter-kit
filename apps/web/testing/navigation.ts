// `redirect()` and `notFound()` end rendering by throwing. Tests replace them with
// these signals so a case can assert where a page sent the user.

/** Thrown by the test `redirect(url)`. */
export class RedirectSignal extends Error {
	public readonly url: string;

	public constructor(url: string) {
		super(`redirect: ${url}`);
		this.name = "RedirectSignal";
		this.url = url;
	}
}

/** Thrown by the test `notFound()`. */
export class NotFoundSignal extends Error {
	public constructor() {
		super("notFound");
		this.name = "NotFoundSignal";
	}
}

type NextNavigationModule = typeof import("next/navigation");

/** The two navigation exits, replaced by functions that throw the signals above. */
export interface NavigationSignalOverrides {
	readonly redirect: (url: string) => void;
	readonly notFound: () => void;
}

/** `next/navigation` with `redirect` / `notFound` throwing the signals above; everything else stays real. */
export function withNavigationSignals(actual: NextNavigationModule): Omit<NextNavigationModule, "redirect" | "notFound"> & NavigationSignalOverrides {
	return {
		...actual,
		redirect: (url: string): void => {
			throw new RedirectSignal(url);
		},
		notFound: (): void => {
			throw new NotFoundSignal();
		},
	};
}

/** How a server page ended: it rendered, it redirected, or it called `notFound()`. */
export type PageExit = { readonly kind: "rendered" } | { readonly kind: "redirect"; readonly url: string } | { readonly kind: "not-found" };

/** Runs `renderPage` and reports how it ended; any other error propagates. */
export async function pageExit(renderPage: () => Promise<void>): Promise<PageExit> {
	try {
		await renderPage();
		return { kind: "rendered" };
	} catch (error: unknown) {
		if (error instanceof RedirectSignal) {
			return { kind: "redirect", url: error.url };
		}
		if (error instanceof NotFoundSignal) {
			return { kind: "not-found" };
		}
		throw error;
	}
}
