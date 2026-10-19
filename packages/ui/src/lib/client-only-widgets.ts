// ============================================
// lib/client-only-widgets.ts — the widgets allowed to skip the server render
// ============================================
// Every page server-renders (decision #56). `next/dynamic(..., { ssr: false })`
// is allowed only for a widget that cannot render without the browser, from a
// `*.client-only.tsx` wrapper whose default export is named here (decision #58).
// The `client-only-widgets/ssr-false-allowlist` lint rule
// (packages/eslint-config/client-only-widgets.js) reads this list through each
// workspace's eslint.config.js, so adding a wrapper means adding its name here,
// with the DOM API it needs. Each wrapper's `loading` fallback is the widget's
// sized skeleton, which is also its server output.

export const CLIENT_ONLY_WIDGETS: readonly [
	"ChartContainerClientOnly",
	"TimeSeriesChartClientOnly",
	"ImageCropDialogClientOnly",
	"MerchantKybDocumentPreviewDialogClientOnly",
	"CommandPaletteClientOnly",
	"AdminCommandPaletteClientOnly",
	"MerchantCommandPaletteClientOnly",
] = [
	// packages/ui chart.client-only.tsx — recharts' ResponsiveContainer measures its box (ResizeObserver, getBoundingClientRect).
	"ChartContainerClientOnly",
	// packages/ui time-series-chart.client-only.tsx — recharts (ResizeObserver) and the reduced-motion media query (matchMedia).
	"TimeSeriesChartClientOnly",
	// packages/client image-crop-dialog.client-only.tsx — a picked File decoded to an ImageBitmap, cropped on a canvas with pointer events.
	"ImageCropDialogClientOnly",
	// packages/client KYB document-preview-dialog.client-only.tsx — the browser PDF engine in an iframe (navigator.pdfViewerEnabled), Fullscreen API, blob: URLs; opened only by a click.
	"MerchantKybDocumentPreviewDialogClientOnly",
	// apps/web command-palette.client-only.tsx — opened by a ⌘K keydown on document; recent searches and pins come from localStorage.
	"CommandPaletteClientOnly",
	// apps/admin command-palette.client-only.tsx — opened by a ⌘K keydown on document; recent searches and pins come from localStorage.
	"AdminCommandPaletteClientOnly",
	// apps/merchant merchant-command-palette.client-only.tsx — opened by a ⌘K keydown on document; recent searches and pins come from localStorage.
	"MerchantCommandPaletteClientOnly",
];

/** The name of a widget that may skip the server render. */
export type ClientOnlyWidgetName = (typeof CLIENT_ONLY_WIDGETS)[number];
