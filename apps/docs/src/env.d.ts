/// <reference types="astro/client" />

interface ImportMetaEnv {
	/** Public origin of the docs site, e.g. `https://docs.example.com` (canonical URLs, sitemap, RSS). */
	readonly PUBLIC_SITE_URL?: string;
	/** Admin panel origin, linked from the header. */
	readonly PUBLIC_ADMIN_URL?: string;
	/** API Swagger UI, linked from the header. */
	readonly PUBLIC_API_DOCS_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
