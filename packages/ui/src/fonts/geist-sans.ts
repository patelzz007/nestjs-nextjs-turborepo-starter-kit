import localFont from "next/font/local";

/** UI and body face shared by every app (and the docs site, which loads the same files through Astro). */
export const geistSans = localFont({
	src: [
		{ path: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
		{ path: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
	],
	variable: "--font-sans",
	display: "swap",
});
