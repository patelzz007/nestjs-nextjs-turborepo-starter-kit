import { z } from "zod";

/**
 * The `/components` gallery's table of contents — every low-level web
 * primitive of `@workspace/ui` the page demonstrates, grouped by family. The
 * table of contents and every section heading read from here, so an entry
 * can never be listed without a section (or the reverse): the gallery tests
 * render the page and check both against this catalog.
 */

/** Stable key of one demonstrated component (camelCase of its `packages/ui/src/components` file). */
export const GalleryComponentKeySchema = z.enum([
	"button",
	"buttonGroup",
	"toggle",
	"toggleGroup",
	"kbd",
	"field",
	"label",
	"input",
	"inputGroup",
	"textarea",
	"passwordInput",
	"passwordStrengthMeter",
	"inputOtp",
	"checkbox",
	"radioGroup",
	"switch",
	"slider",
	"select",
	"combobox",
	"calendar",
	"datePicker",
	"multiDatePicker",
	"dialog",
	"alertDialog",
	"sheet",
	"drawer",
	"popover",
	"hoverCard",
	"tooltip",
	"dropdownMenu",
	"contextMenu",
	"command",
	"accordion",
	"collapsible",
	"tabs",
	"breadcrumb",
	"pagination",
	"stepper",
	"tree",
	"scrollArea",
	"alert",
	"toast",
	"progress",
	"spinner",
	"skeleton",
	"empty",
	"badge",
	"statusBadge",
	"card",
	"statCard",
	"kpiStatCard",
	"table",
	"dataTable",
	"iconTile",
	"relativeTime",
	"separator",
	"avatar",
	"userAvatar",
	"entityAvatar",
	"aspectRatio",
	"coverImage",
	"carousel",
	"imageCarousel",
	"imageResizer",
	"attachment",
	"bubble",
	"message",
	"codeBlock",
	"qrCode",
	"pdfViewer",
	"numberField",
	"phoneInput",
	"nativeSelect",
	"autocomplete",
	"colorPicker",
	"timePicker",
	"rating",
	"signaturePad",
	"fileUpload",
	"emojiPicker",
	"dateSelector",
	"cascader",
	"navigationMenu",
	"menubar",
	"scrollspy",
	"timeline",
	"questionnaire",
	"sidebar",
	"resizable",
	"trace",
	"item",
	"frame",
	"iconStack",
	"fileType",
	"chart",
	"marker",
	"dataGrid",
	"filters",
	"sortable",
	"kanban",
	"gantt",
	"eventCalendar",
	"messageScroller",
]);

export type GalleryComponentKey = z.output<typeof GalleryComponentKeySchema>;

/** One demonstrated component: its page slug, the section's anchor id, its exported name and a one-line description. */
export interface GalleryEntry {
	/** The component's page, `/components/<slug>`: its file name in `packages/ui/src/components`. */
	readonly slug: string;
	/** Anchor id of the section (`component-<file name>`). */
	readonly id: string;
	/** The component's exported name, exactly as imported from `@workspace/ui/components/*`. */
	readonly name: string;
	readonly description: string;
}

/** Prefix of every section anchor, so a gallery id never collides with the shell's own ids. */
const SECTION_ID_PREFIX = "component-";

/** `fileName` is the component's file in `packages/ui/src/components` (without `.tsx`). */
function entry(fileName: string, name: string, description: string): GalleryEntry {
	return { slug: fileName, id: `${SECTION_ID_PREFIX}${fileName}`, name, description };
}

export const GALLERY_ENTRIES: Readonly<Record<GalleryComponentKey, GalleryEntry>> = {
	button: entry("button", "Button", "The primary action control: six variants, five sizes and four icon sizes, with built-in loading, disabled and invalid states."),
	buttonGroup: entry("button-group", "ButtonGroup", "Joins related buttons (and a text segment) into one segmented control, horizontally or vertically."),
	toggle: entry("toggle", "Toggle", "A two-state button for an on/off option, such as a formatting mark."),
	toggleGroup: entry("toggle-group", "ToggleGroup", "A set of toggles where one or several can be pressed — a segmented picker when the spacing is zero."),
	kbd: entry("kbd", "Kbd", "Renders a keyboard key or a shortcut chord."),
	field: entry("field", "Field", "Lays out a label, its control, a hint and an error message — vertically or horizontally — and groups fields into a fieldset."),
	label: entry("label", "Label", "The accessible caption of a form control, linked to it by htmlFor."),
	input: entry("input", "Input", "A single-line text input in three sizes, with loading, disabled and invalid states."),
	inputGroup: entry("input-group", "InputGroup", "An input with icons, text or buttons attached on either side."),
	textarea: entry("textarea", "Textarea", "A multi-line text input in three sizes."),
	passwordInput: entry("password-input", "PasswordInput", "A password input with a show/hide toggle and a Caps Lock warning."),
	passwordStrengthMeter: entry("password-strength-meter", "PasswordStrengthMeter", "Shows how strong a password is, with a checklist of the rules it still misses."),
	inputOtp: entry("input-otp", "InputOTP", "Entry for a one-time code, one character per slot."),
	checkbox: entry("checkbox", "Checkbox", "A boolean choice, in three sizes, including the indeterminate (mixed) state."),
	radioGroup: entry("radio-group", "RadioGroup", "A single choice from a short list of options."),
	switch: entry("switch", "Switch", "Turns a setting on or off immediately."),
	slider: entry("slider", "Slider", "Picks a number, or a range with two thumbs, by dragging along a track."),
	select: entry("select", "Select", "Picks one or several values from a list in a popup."),
	combobox: entry("combobox", "Combobox", "A searchable select: type to filter the options, then pick one or several."),
	calendar: entry("calendar", "Calendar", "A month grid for picking one day, several days or a range."),
	datePicker: entry("date-picker", "DatePicker", "A trigger that opens a calendar to pick one day (yyyy-MM-dd)."),
	multiDatePicker: entry("multi-date-picker", "MultiDatePicker", "A trigger that opens a calendar to pick several days, up to a limit."),
	dialog: entry("dialog", "Dialog", "A modal window for a focused task; it traps focus until closed."),
	alertDialog: entry("alert-dialog", "AlertDialog", "A modal that asks for an explicit confirmation before a consequential action."),
	sheet: entry("sheet", "Sheet", "A panel that slides in from an edge of the screen."),
	drawer: entry("drawer", "Drawer", "A bottom panel that can be swiped away — the touch-friendly sheet."),
	popover: entry("popover", "Popover", "Rich, interactive content anchored to a trigger."),
	hoverCard: entry("hover-card", "HoverCard", "A preview card shown while hovering or focusing a link."),
	tooltip: entry("tooltip", "Tooltip", "A short text label shown on hover or focus."),
	dropdownMenu: entry("dropdown-menu", "DropdownMenu", "A menu of actions, checkboxes, radio items and submenus opened from a button."),
	contextMenu: entry("context-menu", "ContextMenu", "The same menu, opened by right-clicking (or long-pressing) an area."),
	command: entry("command", "Command", "A searchable list of commands, navigable with the keyboard."),
	accordion: entry("accordion", "Accordion", "Stacked sections that expand and collapse one at a time or together."),
	collapsible: entry("collapsible", "Collapsible", "Shows and hides one region behind a trigger."),
	tabs: entry("tabs", "Tabs", "Switches between panels of related content, in a filled or an underline style."),
	breadcrumb: entry("breadcrumb", "Breadcrumb", "Shows where the page sits in the hierarchy, with collapsible middle levels."),
	pagination: entry("pagination", "Pagination", "Moves between the pages of a long list."),
	stepper: entry("stepper", "Stepper", "Shows progress through a multi-step flow; the parent decides which step is active."),
	tree: entry("tree", "Tree", "A hierarchical, keyboard-navigable list of expandable folders and leaves."),
	scrollArea: entry("scroll-area", "ScrollArea", "A scroll container with a themed, overlay scrollbar."),
	alert: entry("alert", "Alert", "An inline message about the page or the current task, in five tones."),
	toast: entry("toast", "Toast", "A transient notification that stacks in a corner of the screen."),
	progress: entry("progress", "Progress", "Shows how far a task has advanced, as a bar with an optional label and value."),
	spinner: entry("spinner", "Spinner", "An indeterminate busy indicator for small, unpredictable waits."),
	skeleton: entry("skeleton", "Skeleton", "Placeholder bones that hold a layout's shape while it loads."),
	empty: entry("empty", "Empty", "The empty state of a list or a page, with a call to action."),
	badge: entry("badge", "Badge", "A small label for a count, a status or a category."),
	statusBadge: entry("status-badge", "StatusBadge", "A badge coloured by a semantic tone (success, warning, danger…) rather than a raw variant."),
	card: entry("card", "Card", "A surface that groups a header, content and footer."),
	statCard: entry("stat-card", "StatCard", "A metric tile: a label, a value, a hint and an icon."),
	kpiStatCard: entry("kpi-stat-card", "KpiStatCard", "A KPI tile with its change against the previous period, and a loading state."),
	table: entry("table", "Table", "The semantic table primitives: header, body, footer and caption."),
	dataTable: entry("data-table", "DataTable", "A full data grid on TanStack Table: sorting, filtering, selection, pagination and row actions."),
	iconTile: entry("icon-tile", "IconTile", "A tinted square that frames an icon, in nine tones and three sizes."),
	relativeTime: entry("relative-time", "RelativeTime", "A time shown relative to now (“5 minutes ago”), kept up to date."),
	separator: entry("separator", "Separator", "A thin rule between groups of content, horizontal or vertical."),
	avatar: entry("avatar", "Avatar", "A person's image with an initials fallback, a status badge and stacked groups."),
	userAvatar: entry("user-avatar", "UserAvatar", "A user's photo (responsive renditions) or their initials."),
	entityAvatar: entry("entity-avatar", "EntityAvatar", "A tenant's or product's logo, or a monogram tinted from its name."),
	aspectRatio: entry("aspect-ratio", "AspectRatio", "Keeps its content at a fixed width-to-height ratio."),
	coverImage: entry("cover-image", "CoverImage", "A responsive image at a fixed ratio, with a loading shimmer and a fallback."),
	carousel: entry("carousel", "Carousel", "A horizontally or vertically scrolling strip of slides with arrows."),
	imageCarousel: entry("image-carousel", "ImageCarousel", "A ready-made photo carousel with arrows and dot navigation."),
	imageResizer: entry("image-resizer", "ImageResizer", "An image resized by dragging its corner and edge handles, or with the arrow keys."),
	attachment: entry("attachment", "Attachment", "A file chip with its upload state (uploading, processing, error, done) and actions."),
	bubble: entry("bubble", "Bubble", "A chat bubble, with variants and reactions."),
	message: entry("message", "Message", "A chat message: avatar, header, content and footer, aligned to either side."),
	codeBlock: entry("code-block", "CodeBlock", "Syntax-highlighted code with line numbers, wrapping, copy and download."),
	qrCode: entry("qr-code", "QrCode", "Renders a value as a scannable QR code."),
	pdfViewer: entry("pdf-viewer", "PdfViewer", "Shows a PDF from a signed URL or a picked file, drawn by the browser's own PDF engine."),
	numberField: entry("number-field", "NumberField", "A numeric input with increment and decrement buttons and a drag-to-scrub label."),
	phoneInput: entry("phone-input", "PhoneInput", "A phone number input with a searchable country picker, formatted as you type."),
	nativeSelect: entry("native-select", "NativeSelect", "The browser's own select, styled like the kit — best for long lists on touch devices."),
	autocomplete: entry("autocomplete", "Autocomplete", "A free-text input that suggests matching values as you type."),
	colorPicker: entry("color-picker", "ColorPicker", "Picks a colour from an area, sliders, swatches or typed values in several formats."),
	timePicker: entry("time-picker", "TimePicker", "Picks a time of day from hour, minute and period columns, or by typing."),
	rating: entry("rating", "Rating", "Shows a score out of a number of stars, or lets the user pick one."),
	signaturePad: entry("signature-pad", "SignaturePad", "A drawing surface for a handwritten signature, with undo, redo and clear."),
	fileUpload: entry("file-upload", "useFileUpload", "Picks and validates files (type, size, count) by drop or dialog; uploading is the caller's job."),
	emojiPicker: entry("emoji-picker", "EmojiPicker", "A searchable emoji grid with categories, recent picks and skin tones."),
	dateSelector: entry("date-selector", "DateSelector", "Picks a day, month, quarter, half-year or year — or a range of them — as a filter value."),
	cascader: entry("cascader", "Cascader", "Picks a value from a hierarchy, one column per level, with search and async loading."),
	navigationMenu: entry("navigation-menu", "NavigationMenu", "A site navigation bar with dropdown panels of links."),
	menubar: entry("menubar", "Menubar", "A desktop-style row of menus (File, Edit, View…)."),
	scrollspy: entry("scrollspy", "Scrollspy", "Highlights the navigation link of the section currently in view."),
	timeline: entry("timeline", "Timeline", "A vertical or horizontal sequence of dated events with indicators."),
	questionnaire: entry("questionnaire", "Questionnaire", "A one-question-at-a-time flow with progress, skipping and a final submit."),
	sidebar: entry("sidebar", "Sidebar", "The collapsible app navigation panel, shown here in a bounded frame."),
	resizable: entry("resizable", "Resizable", "Panels the user can resize by dragging the handle between them."),
	trace: entry("trace", "Trace", "A step-by-step log of a running process, each step collapsible to its detail."),
	item: entry("item", "Item", "A list row with media, a title, a description and actions."),
	frame: entry("frame", "Frame", "A framed panel that groups related content, with a header and a footer."),
	iconStack: entry("icon-stack", "IconStack", "Overlaps several icons or avatars into one compact stack."),
	fileType: entry("file-type", "FileType", "A file icon labelled with its type (PDF, XLSX…), coloured by category."),
	chart: entry("chart", "ChartContainer", "Recharts charts themed with the kit's chart tokens, with tooltips and legends."),
	marker: entry("marker", "Marker", "A small pointer that marks a position — a step, a value or a point on a chart."),
	dataGrid: entry("data-grid", "DataGrid", "A full data grid: sorting, filtering, column resize, reorder and visibility, row selection, virtualisation."),
	filters: entry("filters", "Filters", "A filter bar: add conditions per field with operators, dates and grouping, and serialise them to a query."),
	sortable: entry("sortable", "Sortable", "A list the user reorders by dragging or with the keyboard."),
	kanban: entry("kanban", "Kanban", "Columns of cards the user moves between columns by dragging or with the keyboard."),
	gantt: entry("gantt", "Gantt", "A timeline of tasks as bars, with dependencies, drag-to-reschedule and zoom levels."),
	eventCalendar: entry("event-calendar", "EventCalendar", "A month, week, day, agenda and resource calendar of events, with drag-to-move."),
	messageScroller: entry("message-scroller", "MessageScroller", "A chat transcript that keeps the newest message in view as messages arrive."),
};

/**
 * Components shown through their worked examples only (examples/<component>),
 * with no hand-written live demo above them — the newer kit components ported
 * with their reui examples.
 */
export const EXAMPLE_ONLY_KEYS: ReadonlySet<GalleryComponentKey> = new Set<GalleryComponentKey>([
	"numberField",
	"phoneInput",
	"nativeSelect",
	"autocomplete",
	"colorPicker",
	"timePicker",
	"rating",
	"signaturePad",
	"fileUpload",
	"emojiPicker",
	"dateSelector",
	"cascader",
	"navigationMenu",
	"menubar",
	"scrollspy",
	"timeline",
	"questionnaire",
	"sidebar",
	"resizable",
	"trace",
	"item",
	"frame",
	"iconStack",
	"fileType",
	"chart",
	"marker",
	"dataGrid",
	"filters",
	"sortable",
	"kanban",
	"gantt",
	"eventCalendar",
	"messageScroller",
]);

/** Anchor id of each family heading. */
export const GalleryFamilyIdSchema = z.enum([
	"family-actions",
	"family-form-inputs",
	"family-selection",
	"family-overlays",
	"family-disclosure-navigation",
	"family-feedback-status",
	"family-data-display",
	"family-media-content",
]);

export type GalleryFamilyId = z.output<typeof GalleryFamilyIdSchema>;

/** One table-of-contents group. */
export interface GalleryFamily {
	/** Anchor id of the family heading. */
	readonly id: GalleryFamilyId;
	readonly title: string;
	readonly keys: readonly GalleryComponentKey[];
}

export const GALLERY_FAMILIES: readonly GalleryFamily[] = [
	{ id: "family-actions", title: "Actions", keys: ["button", "buttonGroup", "toggle", "toggleGroup", "kbd"] },
	{
		id: "family-form-inputs",
		title: "Form inputs",
		keys: [
			"field",
			"label",
			"input",
			"inputGroup",
			"textarea",
			"passwordInput",
			"passwordStrengthMeter",
			"inputOtp",
			"numberField",
			"phoneInput",
			"nativeSelect",
			"autocomplete",
			"colorPicker",
			"timePicker",
			"rating",
			"signaturePad",
			"fileUpload",
		],
	},
	{
		id: "family-selection",
		title: "Selection",
		keys: ["checkbox", "radioGroup", "switch", "slider", "select", "combobox", "calendar", "datePicker", "multiDatePicker", "emojiPicker", "dateSelector", "cascader"],
	},
	{
		id: "family-overlays",
		title: "Overlays",
		keys: ["dialog", "alertDialog", "sheet", "drawer", "popover", "hoverCard", "tooltip", "dropdownMenu", "contextMenu", "command"],
	},
	{
		id: "family-disclosure-navigation",
		title: "Disclosure & navigation",
		keys: [
			"accordion",
			"collapsible",
			"tabs",
			"breadcrumb",
			"pagination",
			"stepper",
			"tree",
			"scrollArea",
			"navigationMenu",
			"menubar",
			"scrollspy",
			"timeline",
			"questionnaire",
			"sidebar",
			"resizable",
		],
	},
	{
		id: "family-feedback-status",
		title: "Feedback & status",
		keys: ["alert", "toast", "progress", "spinner", "skeleton", "empty", "badge", "statusBadge", "trace"],
	},
	{
		id: "family-data-display",
		title: "Data display",
		keys: [
			"card",
			"statCard",
			"kpiStatCard",
			"table",
			"dataTable",
			"iconTile",
			"relativeTime",
			"separator",
			"item",
			"frame",
			"iconStack",
			"fileType",
			"chart",
			"marker",
			"dataGrid",
			"filters",
			"sortable",
			"kanban",
			"gantt",
			"eventCalendar",
		],
	},
	{
		id: "family-media-content",
		title: "Media & content",
		keys: [
			"avatar",
			"userAvatar",
			"entityAvatar",
			"aspectRatio",
			"coverImage",
			"carousel",
			"imageCarousel",
			"imageResizer",
			"attachment",
			"bubble",
			"message",
			"codeBlock",
			"qrCode",
			"pdfViewer",
			"messageScroller",
		],
	},
];

/**
 * Kit components the gallery deliberately leaves out: the app shell and
 * infrastructure (mounted once by the layout, not composed by pages) and the
 * composite, domain-shaped surfaces built from the primitives above.
 */
export const NOT_SHOWN_COMPONENTS: readonly string[] = [
	"App shell (app-*, panel-*, shell-theme-toggle, scroll-to-top, layout-transition)",
	"Providers and guards (theme-provider, ui-kit-labels-provider, redux-devtools-guard)",
	"Analytics compositions (analytics-*, time-series-chart, ranked-bar-list, share-bar)",
	"Page compositions (auth-layout, form-shell, not-found-content, lockout-countdown)",
	"Specialised editors (image-cropper)",
];

/** One component in catalog order, with the family it belongs to. */
export interface GalleryCatalogItem {
	readonly key: GalleryComponentKey;
	readonly entry: GalleryEntry;
	readonly family: GalleryFamily;
}

/** Every component in catalog order (family by family): the gallery's navigation and its previous / next links follow it. */
export const GALLERY_CATALOG_ORDER: readonly GalleryCatalogItem[] = GALLERY_FAMILIES.flatMap((family: GalleryFamily): GalleryCatalogItem[] =>
	family.keys.map((key: GalleryComponentKey): GalleryCatalogItem => ({ key, entry: GALLERY_ENTRIES[key], family })),
);

const ITEMS_BY_SLUG: ReadonlyMap<string, GalleryCatalogItem> = new Map<string, GalleryCatalogItem>(
	GALLERY_CATALOG_ORDER.map((item: GalleryCatalogItem): [string, GalleryCatalogItem] => [item.entry.slug, item]),
);

/** The component whose page is `/components/<slug>`, or `undefined` for a slug the gallery does not have. */
export function galleryItemBySlug(slug: string): GalleryCatalogItem | undefined {
	return ITEMS_BY_SLUG.get(slug);
}

/** The components before and after `key` in catalog order (`undefined` at either end). */
export interface GalleryNeighbours {
	readonly previous: GalleryCatalogItem | undefined;
	readonly next: GalleryCatalogItem | undefined;
}

export function galleryNeighbours(key: GalleryComponentKey): GalleryNeighbours {
	const index = GALLERY_CATALOG_ORDER.findIndex((item: GalleryCatalogItem): boolean => item.key === key);
	// `.at(-1)` would wrap to the last item, so the first component has no previous one.
	const previous = index > 0 ? GALLERY_CATALOG_ORDER.at(index - 1) : undefined;
	return { previous, next: GALLERY_CATALOG_ORDER.at(index + 1) };
}
