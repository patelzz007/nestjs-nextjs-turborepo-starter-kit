const DEFAULT_COOKIE_NAME = "sidebar_state";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Injectable persistence for sidebar open/collapsed state (rule 9 — smart parent can own storage). */
export interface SidebarStorageAdapter {
	read(): boolean | null;
	write(open: boolean): void;
}

export interface CreateCookieSidebarStorageOptions {
	readonly cookieName?: string;
	readonly maxAgeSeconds?: number;
}

/** Default adapter — persists open state in a browser cookie. */
export function createCookieSidebarStorage(options: CreateCookieSidebarStorageOptions = {}): SidebarStorageAdapter {
	const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
	const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

	return {
		read(): boolean | null {
			if (typeof document === "undefined") {
				return null;
			}
			const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
			if (match === null || match[1] === undefined) {
				return null;
			}
			const value = decodeURIComponent(match[1]);
			if (value === "true") {
				return true;
			}
			if (value === "false") {
				return false;
			}
			return null;
		},
		write(open: boolean): void {
			if (typeof document === "undefined") {
				return;
			}
			document.cookie = `${cookieName}=${String(open)}; path=/; max-age=${String(maxAgeSeconds)}`;
		},
	};
}
