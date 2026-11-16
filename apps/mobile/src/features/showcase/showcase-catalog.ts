import { z } from "zod";

/**
 * The showcase's table of contents: every low-level UI kit component the
 * phone's showcase demonstrates, grouped by family. It lists the same
 * components, in the same families and order, as the web admin's showcase
 * (apps/admin components/component-showcase/showcase-catalog.ts), so a slug
 * opens the same component on either. Each entry names the kit modules that
 * make it up on a phone: a web component a phone draws another way (the web's
 * `Select` popup is `SelectField`'s bottom sheet) keeps the web's slug and
 * shows the phone's component. Every entry's examples live in
 * `features/showcase/examples/<slug>/` (the showcase tests check both
 * directions), and every kit module is in some entry or in
 * `NOT_SHOWN_MODULES`.
 */

/** Stable key of one demonstrated component (camelCase of its slug), as on the web. */
export const ShowcaseComponentKeySchema = z.enum([
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
	"richTextEditor",
	"richTextView",
	"diagram",
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

export type ShowcaseComponentKey = z.output<typeof ShowcaseComponentKeySchema>;

/** One demonstrated component: its page slug, its exported name, a one-line description and the kit modules it is made of. */
export interface ShowcaseEntry {
	/** The web showcase's slug for the same component: the folder of its examples, and its page (`/showcase/<slug>`). */
	readonly slug: string;
	/** Anchor id of the component (`component-<slug>`), as on the web. */
	readonly id: string;
	/** The component's exported name, exactly as imported from the kit. */
	readonly name: string;
	readonly description: string;
	/**
	 * The kit modules whose exports make up this component's API, its main one first: a file name in the kit's
	 * `components/` (`button`), or a path in the kit (`lib/use-file-upload`).
	 */
	readonly modules: readonly string[];
}

/** Prefix of every component's anchor, so it never collides with a family's. */
const SECTION_ID_PREFIX = "component-";

/** `modules` defaults to the slug: the kit file of the same name. */
function entry(slug: string, name: string, description: string, modules: readonly string[] = [slug]): ShowcaseEntry {
	return { slug, id: `${SECTION_ID_PREFIX}${slug}`, name, description, modules };
}

export const SHOWCASE_ENTRIES: Readonly<Record<ShowcaseComponentKey, ShowcaseEntry>> = {
	button: entry(
		"button",
		"Button",
		"The primary action control: five variants and three sizes, with built-in loading, disabled and invalid states, an icon-only twin and an inline link.",
		["button", "icon-button", "text-link"],
	),
	buttonGroup: entry("button-group", "ButtonGroup", "Joins related buttons (and a text segment) into one segmented control, horizontally or vertically."),
	toggle: entry("toggle", "Toggle", "A two-state button for an on/off option, such as a formatting mark.", ["toggle", "toggle-mark"]),
	toggleGroup: entry("toggle-group", "ToggleGroup", "A set of toggles where one or several can be pressed, and the segmented picker for one choice.", [
		"toggle-group",
		"segmented-control",
	]),
	kbd: entry("kbd", "Kbd", "Renders a key or a shortcut chord of a hardware keyboard, for tablets and phones with one attached."),
	field: entry("field", "Field", "Lays out a label, its control, a hint and an error message, and the ready-made labelled text field.", ["field", "text-field"]),
	label: entry("label", "Label", "The caption of a form control, in the kit's label type role.", ["text"]),
	input: entry("input", "Input", "A single-line text input in three sizes, with loading, disabled and invalid states."),
	inputGroup: entry("input-group", "InputGroup", "An input with icons, text or buttons attached on either side."),
	textarea: entry("textarea", "Textarea", "A multi-line text input in three sizes."),
	passwordInput: entry("password-input", "PasswordInput", "A password input with a show/hide toggle."),
	passwordStrengthMeter: entry("password-strength-meter", "PasswordStrengthMeter", "Shows how strong a password is, with a checklist of the rules it still misses."),
	inputOtp: entry("input-otp", "InputOTP", "Entry for a one-time code, one character per slot, filled from the keyboard's suggestion."),
	checkbox: entry("checkbox", "Checkbox", "A boolean choice, in three sizes, including the indeterminate (mixed) state."),
	radioGroup: entry("radio-group", "RadioGroup", "A single choice from a short list of options."),
	switch: entry("switch", "Switch", "Turns a setting on or off immediately."),
	slider: entry("slider", "Slider", "Picks a number by dragging along a track, and a range (or several stops) with `RangeSlider`.", ["slider", "range-slider"]),
	select: entry("select", "SelectField", "Picks one or several values from a list in a bottom sheet: the phone's select.", ["select-field"]),
	combobox: entry("combobox", "Combobox", "A searchable select: type to filter the options, then pick one or several."),
	calendar: entry("calendar", "Calendar", "A month calendar for picking one day, several days or a range, with month and year navigation.", [
		"calendar",
		"calendar-month-grid",
		"calendar-navigator",
		"date-range-picker",
	]),
	datePicker: entry("date-picker", "DateField", "A field that opens a calendar in a bottom sheet to pick one day (yyyy-MM-dd).", ["date-field", "calendar-field"]),
	multiDatePicker: entry("multi-date-picker", "MultiDateField", "A field that opens a calendar to pick several days, up to a limit.", ["multi-date-field"]),
	dialog: entry("dialog", "Dialog", "A modal window for a focused task; nothing behind it can be reached until it closes."),
	alertDialog: entry("alert-dialog", "AlertDialog", "A modal that asks for an explicit confirmation before a consequential action."),
	sheet: entry("sheet", "Sheet", "A panel that slides in from a side of the screen, swiped or tapped away."),
	drawer: entry("drawer", "Drawer", "A panel that slides in from an edge and is swiped back to close: the phone's drawer.", ["sheet", "bottom-sheet"]),
	popover: entry("popover", "Popover", "Rich, interactive content anchored to the control that opened it."),
	hoverCard: entry("hover-card", "HoverCard", "A preview card shown while a link is pressed and held: the phone's hover."),
	tooltip: entry("tooltip", "Tooltip", "A short text label shown when a control is pressed and held."),
	dropdownMenu: entry("dropdown-menu", "DropdownMenu", "A menu of actions, checkboxes and radio items opened from a button."),
	contextMenu: entry("context-menu", "ContextMenu", "The same menu, opened by pressing and holding an area."),
	command: entry("command", "CommandPalette", "A searchable list of commands, always open or in a full-screen sheet.", ["command-palette"]),
	accordion: entry("accordion", "Accordion", "Stacked sections that expand and collapse one at a time or together."),
	collapsible: entry("collapsible", "Collapsible", "Shows and hides one region behind a trigger."),
	tabs: entry("tabs", "Tabs", "Switches between panels of related content, in a filled or an underline style."),
	breadcrumb: entry("breadcrumb", "Breadcrumb", "Shows where the screen sits in the hierarchy, scrolling sideways when it is long."),
	pagination: entry("pagination", "Pagination", "Moves between the pages of a long list."),
	stepper: entry("stepper", "Stepper", "Shows progress through a multi-step flow; the parent decides which step is active."),
	tree: entry("tree", "Tree", "A hierarchical list of expandable folders and leaves, with guides, glyphs and cascading checkboxes.", ["tree", "tree-branch"]),
	scrollArea: entry("scroll-area", "ScrollArea", "A bounded scroll container, vertical or sideways, with edge fades that say there is more."),
	alert: entry("alert", "Alert", "An inline message about the screen or the current task, in five tones."),
	toast: entry("toast", "Toast", "A transient notification that slides in from the top of the screen."),
	progress: entry("progress", "Progress", "Shows how far a task has advanced, as a bar with an optional label and value."),
	spinner: entry("spinner", "Spinner", "An indeterminate busy indicator for small, unpredictable waits."),
	skeleton: entry("skeleton", "Skeleton", "Placeholder bones that hold a layout's shape while it loads."),
	empty: entry("empty", "EmptyState", "The empty state of a list or a screen, with a call to action, and its loading and error twins."),
	badge: entry("badge", "Badge", "A small label for a status or a category, and the count that rides on an icon.", ["badge", "count-badge"]),
	statusBadge: entry("status-badge", "StatusBadge", "A badge coloured by a semantic tone (success, warning, danger…) rather than a raw variant.", [
		"status-badge",
		"pulse-dot",
	]),
	card: entry("card", "Card", "A surface that groups a header, content and footer."),
	statCard: entry("stat-card", "StatTiles", "Metric tiles: a label and a value each, wrapping onto more rows on a narrow screen.", ["stat-tiles"]),
	kpiStatCard: entry("kpi-stat-card", "KpiStatCard", "A KPI tile with its change against the previous period, and a loading state."),
	table: entry("table", "Table", "A table that scrolls sideways, and the label-value list a phone reads more easily.", ["table", "detail-list"]),
	dataTable: entry("data-table", "DataTable", "A records table on TanStack Table: search, filters, sorting, paging, selection, row actions, export and cards.", [
		"data-table",
		"data-table-card",
	]),
	iconTile: entry("icon-tile", "IconTile", "A tinted square that frames an icon, in nine tones and three sizes."),
	relativeTime: entry("relative-time", "RelativeTime", "A time shown relative to now (“5 minutes ago”), kept up to date."),
	separator: entry("separator", "Separator", "A thin rule between groups of content, horizontal or vertical."),
	avatar: entry("avatar", "Avatar", "A person's image with an initials fallback, badges, rings and colours, and stacked groups.", ["avatar", "avatar-group"]),
	userAvatar: entry("user-avatar", "UserAvatar", "A user's photo (the rendition that fits) or their initials: the kit's Avatar with `sources`.", ["avatar"]),
	entityAvatar: entry(
		"entity-avatar",
		"EntityAvatar",
		'A tenant\'s or product\'s logo, or a monogram tinted from its name: the kit\'s Avatar, `shape="rounded"` with `tone="name"`.',
		["avatar"],
	),
	aspectRatio: entry("aspect-ratio", "AspectRatio", "Keeps its content at a fixed width-to-height ratio."),
	coverImage: entry("cover-image", "CoverImage", "An image at a fixed ratio, with a loading shimmer and a fallback."),
	carousel: entry("carousel", "Carousel", "A paging strip of slides, sideways or vertical, with arrows and dots."),
	imageCarousel: entry("image-carousel", "ImageCarousel", "A ready-made photo carousel with dot navigation."),
	imageResizer: entry("image-resizer", "ImageResizer", "An image resized by dragging its corner handle, or with the adjust gesture of a screen reader."),
	attachment: entry("attachment", "Attachment", "A file chip with its upload state (uploading, processing, error, done) and actions."),
	bubble: entry("bubble", "Bubble", "A chat bubble, with variants and reactions."),
	message: entry("message", "Message", "A chat message: avatar, header, content and footer, aligned to either side."),
	codeBlock: entry("code-block", "CodeBlock", "Syntax-highlighted code with line numbers and copy, scrolling sideways when a line is long."),
	richTextEditor: entry(
		"rich-text-editor",
		"RichTextEditor",
		"A toolbar rich-text editor limited to what a broadcast may hold: headings, marks, https links, lists, code and one button.",
	),
	richTextView: entry("rich-text-view", "RichTextView", "Draws a stored rich-text document: tables scroll sideways, code blocks copy, a button shows its real domain."),
	diagram: entry(
		"diagram",
		"Diagram",
		"Draws Mermaid-syntax text (flowcharts, sequences and every type Pele supports) with react-native-svg, themed from the design tokens, with an accessible summary.",
	),
	qrCode: entry("qr-code", "QrCode", "Renders a value as a scannable QR code, and scans one with the camera.", ["qr-code", "qr-scanner"]),
	pdfViewer: entry("pdf-viewer", "PdfViewer", "Shows a PDF from a signed URL or a picked file, page by page."),
	numberField: entry("number-field", "NumberField", "A numeric input with increment and decrement buttons, clamped and stepped."),
	phoneInput: entry("phone-input", "PhoneInput", "A phone number input with a searchable country picker, formatted as you type."),
	nativeSelect: entry("native-select", "NativeSelect", "The platform's own picker (an action sheet on iOS, a menu on Android), styled like the kit's fields."),
	autocomplete: entry("autocomplete", "Autocomplete", "A free-text input that suggests matching values as you type."),
	colorPicker: entry("color-picker", "ColorPicker", "Picks a colour from an area, sliders, swatches or typed values in several formats."),
	timePicker: entry("time-picker", "TimePicker", "Picks a time of day from hour, minute and period wheels, or by typing."),
	rating: entry("rating", "Rating", "Shows a score out of a number of stars, or lets the user pick one."),
	signaturePad: entry("signature-pad", "SignaturePad", "A drawing surface for a handwritten signature, with undo, redo and clear."),
	fileUpload: entry("file-upload", "useFileUpload", "Picks and validates files (type, size, count) from the document picker; uploading is the caller's job.", [
		"lib/use-file-upload",
	]),
	emojiPicker: entry("emoji-picker", "EmojiPicker", "A searchable emoji grid with categories, recent picks and skin tones."),
	dateSelector: entry("date-selector", "DateSelector", "Picks a day, month, quarter, half-year or year — or a range of them — as a filter value."),
	cascader: entry("cascader", "Cascader", "Picks a value from a hierarchy, one level at a time, with search and async loading."),
	navigationMenu: entry("navigation-menu", "NavigationMenu", "A section's navigation: links in groups, each opening a panel of its own links."),
	menubar: entry("menubar", "Menubar", "A row of menus (File, Edit, View…) for an editor's toolbar."),
	scrollspy: entry("scrollspy", "Scrollspy", "Highlights the link of the section currently in view, and scrolls to a section when its link is tapped."),
	timeline: entry("timeline", "Timeline", "A vertical or horizontal sequence of dated events with indicators.", ["timeline", "timeline-rail"]),
	questionnaire: entry("questionnaire", "Questionnaire", "A one-question-at-a-time flow with progress, skipping and a final submit."),
	sidebar: entry("sidebar", "Sidebar", "The navigation panel that slides in from the side: groups, items, badges and a footer."),
	resizable: entry("resizable", "Resizable", "Panels the user resizes by dragging the handle between them."),
	trace: entry("trace", "Trace", "A step-by-step log of a running process, each step collapsible to its detail."),
	item: entry("item", "Item", "A row of content: media, a title and a description, and actions, with optional header and footer rows.", [
		"item",
		"list-row",
		"list-group",
		"notification-row",
	]),
	frame: entry("frame", "Frame", "A framed panel that groups related content, with a header and a footer."),
	iconStack: entry("icon-stack", "IconStack", "Overlaps several icons or avatars into one compact stack."),
	fileType: entry("file-type", "FileType", "A file icon labelled with its type (PDF, XLSX…), coloured by category."),
	chart: entry("chart", "Chart", "Bar, line, area and pie charts drawn natively, themed with the kit's chart tokens, with a legend and a tapped-point readout."),
	marker: entry("marker", "Marker", "A small pointer that marks a position — a step, a value or a point on a chart."),
	dataGrid: entry(
		"data-grid",
		"DataGrid",
		"A grid over a TanStack table you own: sort, pin, move, resize and hide columns; select, expand, pin and drag rows; footers, virtualised rows and columns, and spreadsheet editing.",
		["data-grid", "data-grid-parts"],
	),
	filters: entry("filters", "Filters", "A filter bar: add conditions per field with operators, and serialise them to a query.", ["filters", "filter-chip"]),
	sortable: entry("sortable", "Sortable", "A list the user reorders by dragging a handle, or with a screen reader's actions."),
	kanban: entry("kanban", "Kanban", "Columns of cards the user moves between columns by dragging, or from a card's menu."),
	gantt: entry("gantt", "Gantt", "A timeline of tasks as bars, with dependencies, progress and zoom levels."),
	eventCalendar: entry("event-calendar", "EventCalendar", "A month, week, day and agenda calendar of events."),
	messageScroller: entry("message-scroller", "MessageScroller", "A chat transcript that keeps the newest message in view as messages arrive."),
};

/** Anchor id of each family, as on the web. */
export const ShowcaseFamilyIdSchema = z.enum([
	"family-actions",
	"family-form-inputs",
	"family-selection",
	"family-overlays",
	"family-disclosure-navigation",
	"family-feedback-status",
	"family-data-display",
	"family-media-content",
]);

export type ShowcaseFamilyId = z.output<typeof ShowcaseFamilyIdSchema>;

/** One table-of-contents group. */
export interface ShowcaseFamily {
	readonly id: ShowcaseFamilyId;
	readonly title: string;
	readonly keys: readonly ShowcaseComponentKey[];
}

export const SHOWCASE_FAMILIES: readonly ShowcaseFamily[] = [
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
			"richTextEditor",
			"richTextView",
			"diagram",
			"qrCode",
			"pdfViewer",
			"messageScroller",
		],
	},
];

/** A kit module the showcase deliberately leaves out, and why. */
export interface NotShownModule {
	readonly module: string;
	readonly reason: string;
}

/**
 * Kit modules no entry demonstrates: infrastructure every other component is
 * built on, mounted once or composed rather than placed on a screen.
 */
export const NOT_SHOWN_MODULES: readonly NotShownModule[] = [
	{ module: "icon", reason: "Icon: the glyph wrapper every component draws its icons through" },
	{ module: "keyboard-avoiding-view", reason: "KeyboardAvoidingView: the frame every screen keeps clear of the keyboard" },
];

/** One component in catalog order, with the family it belongs to. */
export interface ShowcaseCatalogItem {
	readonly key: ShowcaseComponentKey;
	readonly entry: ShowcaseEntry;
	readonly family: ShowcaseFamily;
}

/** Every component in catalog order (family by family): the showcase's sections and navigation follow it. */
export const SHOWCASE_CATALOG_ORDER: readonly ShowcaseCatalogItem[] = SHOWCASE_FAMILIES.flatMap((family: ShowcaseFamily): ShowcaseCatalogItem[] =>
	family.keys.map((key: ShowcaseComponentKey): ShowcaseCatalogItem => ({ key, entry: SHOWCASE_ENTRIES[key], family })),
);

const ITEMS_BY_SLUG: ReadonlyMap<string, ShowcaseCatalogItem> = new Map<string, ShowcaseCatalogItem>(
	SHOWCASE_CATALOG_ORDER.map((item: ShowcaseCatalogItem): [string, ShowcaseCatalogItem] => [item.entry.slug, item]),
);

/** The component whose page is `/showcase/<slug>`, or `undefined` for a slug the showcase does not have. */
export function showcaseItemBySlug(slug: string): ShowcaseCatalogItem | undefined {
	return ITEMS_BY_SLUG.get(slug);
}

/** The components before and after one in catalog order (`undefined` at either end). */
export interface ShowcaseNeighbours {
	readonly previous: ShowcaseCatalogItem | undefined;
	readonly next: ShowcaseCatalogItem | undefined;
}

export function showcaseNeighbours(key: ShowcaseComponentKey): ShowcaseNeighbours {
	const index = SHOWCASE_CATALOG_ORDER.findIndex((item: ShowcaseCatalogItem): boolean => item.key === key);
	// `.at(-1)` would wrap to the last item, so the first component has no previous one.
	const previous = index > 0 ? SHOWCASE_CATALOG_ORDER.at(index - 1) : undefined;
	return { previous, next: index < 0 ? undefined : SHOWCASE_CATALOG_ORDER.at(index + 1) };
}
