/// <reference types="vite/client" />

/** Build-time settings (`envPrefix` in vite.config.ts); every one is optional, the defaults are the local dev ports. */
interface ImportMetaEnv {
	readonly PUBLIC_SITE_URL?: string;
	readonly PUBLIC_ADMIN_URL?: string;
	readonly PUBLIC_API_DOCS_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
