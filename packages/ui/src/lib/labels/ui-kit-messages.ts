// ============================================
// ui-kit-messages.ts - The UI kit's copy, from one JSON catalogue per language (ADR 076)
// ============================================
// Every word the kit shows lives in `messages/<language>.json`: plain strings, ICU messages for anything that
// takes a value (`{count, plural, one {# item} other {# items}}`), and lists (month names). English is the source;
// each other catalogue is typed against it, so a key missing from one is a compile error, and
// `language-packs.test.ts` refuses a message that takes other values than English's. This binding, the same for
// every language, turns a catalogue into the typed `UiKitLabels` the components read: each label that takes values
// becomes a function formatting its message. A label with variants (`cascader.search`: everything, or within a
// branch) keeps them in a group under its own key, which the function replaces.

import { formatMessage, MAX_PDF_VIEWER_FILE_BYTES, type MessageValues } from "@workspace/shared";
import { z } from "zod";

import type { ColorDescription } from "../color/color-name";
import type { FilterRelativeDate } from "../../components/filters/filters-types";
import { formatBytes } from "../format/bytes";
import type ENGLISH_MESSAGES from "./messages/en.json";
import type { UiKitLanguage } from "./language-packs";
import type { UiKitLabels } from "./ui-kit-labels";

/** One language's UI kit catalogue: English's shape, every key required. */
export type UiKitMessages = typeof ENGLISH_MESSAGES;

/**
 * The locale each language formats numbers in (ADR 076 §4): Malaysian conventions, so a Tamil reader sees
 * `1,234,567` (not India's `12,34,567`) and every language its own plural rules.
 */
export const UI_KIT_FORMAT_LOCALES: Readonly<Record<UiKitLanguage, string>> = {
	en: "en-MY",
	ms: "ms-MY",
	"zh-Hans": "zh-Hans-MY",
	ta: "ta-MY",
};

/**
 * Whether a language starts a name with a capital (the emoji picker's names): English and Malay do; Chinese and
 * Tamil scripts have no case, and their packs leave a name (even a Latin fallback) as it is.
 */
const CAPITALISES_NAMES: Readonly<Record<UiKitLanguage, boolean>> = { en: true, ms: true, "zh-Hans": false, ta: false };

/** The emoji picker's six skin tones, in Unicode's order (default, then light to dark). */
const SkinTonesSchema = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string()]);

/** The UI kit's labels in `language`, from its catalogue. */
export function bindUiKitLabels(language: UiKitLanguage, m: UiKitMessages): UiKitLabels {
	const locale = UI_KIT_FORMAT_LOCALES[language];
	const t = (message: string, values?: MessageValues): string => formatMessage(locale, message, values);

	const colorNameOf = (description: ColorDescription): string => {
		const names = m.colorPicker.colorName;
		if (description.kind === "neutral") {
			return names.neutral[description.name];
		}
		return t(names.chromatic, { shade: names.shade[description.shade], tone: names.tone[description.tone], hue: names.hue[description.hue] });
	};

	const relativeDateOf = ({ unit, offset }: FilterRelativeDate): string => {
		const words = m.filters.relativeDate;
		if (offset === 0) {
			return t(words.current, { unit });
		}
		if (unit === "day" && Math.abs(offset) === 1) {
			return offset > 0 ? words.tomorrow : words.yesterday;
		}
		return t(offset > 0 ? words.future : words.past, { unit, count: Math.abs(offset) });
	};

	return {
		alertDialog: m.alertDialog,
		analyticsRangePicker: m.analyticsRangePicker,
		appCommandPalette: {
			...m.appCommandPalette,
			clearScopeAriaLabel: (scopeLabel) => t(m.appCommandPalette.clearScopeAriaLabel, { scopeLabel }),
			expandSectionAriaLabel: (section) => t(m.appCommandPalette.expandSectionAriaLabel, { section }),
			collapseSectionAriaLabel: (section) => t(m.appCommandPalette.collapseSectionAriaLabel, { section }),
			pinItemAriaLabel: (title) => t(m.appCommandPalette.pinItemAriaLabel, { title }),
			unpinItemAriaLabel: (title) => t(m.appCommandPalette.unpinItemAriaLabel, { title }),
			hiddenItemsCount: (count) => t(m.appCommandPalette.hiddenItemsCount, { count }),
			noResultsForQuery: (query) => t(m.appCommandPalette.noResultsForQuery, { query }),
			didYouMean: (title) => t(m.appCommandPalette.didYouMean, { title }),
		},
		appShellProfileDropdown: m.appShellProfileDropdown,
		appShellTopbarSearch: m.appShellTopbarSearch,
		authLayout: m.authLayout,
		breadcrumb: m.breadcrumb,
		breadcrumbTrail: m.breadcrumbTrail,
		carousel: {
			...m.carousel,
			slidePosition: (position, total) => t(m.carousel.slidePosition, { position, total }),
			goToSlide: (position) => t(m.carousel.goToSlide, { position }),
		},
		cascader: {
			...m.cascader,
			search: (parentLabel) => (parentLabel === undefined ? m.cascader.search.all : t(m.cascader.search.within, { parentLabel })),
			selectedCount: (count) => t(m.cascader.selectedCount, { count }),
			removeChip: (label) => t(m.cascader.removeChip, { label }),
			itemCount: (count) => t(m.cascader.itemCount, { count }),
			keyboardHint: (mode, dir) =>
				t(m.cascader.keyboardHint.hint, {
					mode,
					open: dir === "rtl" ? m.cascader.keyboardHint.left : m.cascader.keyboardHint.right,
					back: dir === "rtl" ? m.cascader.keyboardHint.right : m.cascader.keyboardHint.left,
				}),
			rootAnnouncement: (count) => t(m.cascader.rootAnnouncement, { count }),
			expandedAnnouncement: (label, count) => t(m.cascader.expandedAnnouncement, { label, count }),
			collapsedAnnouncement: (label) => t(m.cascader.collapsedAnnouncement, { label }),
			levelAnnouncement: (parentLabel, depth, count) => t(m.cascader.levelAnnouncement, { parentLabel, depth, count }),
			resultsAnnouncement: (count) => t(m.cascader.resultsAnnouncement, { count }),
			maxReachedAnnouncement: (max) => t(m.cascader.maxReachedAnnouncement, { max }),
			cascadeAnnouncement: (label, count, selecting) => t(m.cascader.cascadeAnnouncement, { label, count, selecting: String(selecting) }),
		},
		imageCropper: m.imageCropper,
		imageResizer: {
			...m.imageResizer,
			handle: (handle) => t(m.imageResizer.handle.message, { place: m.imageResizer.handle.places[handle] }),
			size: (size) => t(m.imageResizer.size, { width: size.width, height: size.height }),
		},
		colorPicker: {
			...m.colorPicker,
			formatTrigger: (formatName) => t(m.colorPicker.formatTrigger, { formatName }),
			areaValueText: (saturation, brightness, colorName) => t(m.colorPicker.areaValueText, { saturation, brightness, colorName }),
			hueValueText: (degrees, colorName) => t(m.colorPicker.hueValueText, { degrees, colorName }),
			colorName: (description) => colorNameOf(description),
		},
		codeBlock: {
			...m.codeBlock,
			languageCode: (language) => t(m.codeBlock.languageCode, { language }),
			lines: (regionLabel) => t(m.codeBlock.lines, { regionLabel }),
			foldLines: (from, to) => t(m.codeBlock.foldLines, { from, to }),
			unfoldLines: (from, to) => t(m.codeBlock.unfoldLines, { from, to }),
			unfoldHiddenLines: (count) => t(m.codeBlock.unfoldHiddenLines, { count }),
			hiddenLines: (count) => t(m.codeBlock.hiddenLines, { count }),
			complete: (lineCount) => t(m.codeBlock.complete, { lineCount }),
		},
		combobox: {
			...m.combobox,
			removeOption: (label) => t(m.combobox.removeOption, { label }),
			selectedCount: (count) => t(m.combobox.selectedCount, { count }),
		},
		dataGrid: {
			...m.dataGrid,
			unpinColumn: (title) => t(m.dataGrid.unpinColumn, { title }),
			paginationInfo: ({ from, to, count }) => t(m.dataGrid.paginationInfo, { from, to, count }),
			goToPage: (page) => t(m.dataGrid.goToPage, { page }),
			filterSelectedCount: (count) => t(m.dataGrid.filterSelectedCount, { count }),
			resizeColumn: (title) => t(m.dataGrid.resizeColumn, { title }),
			selectionBarCount: (count) => t(m.dataGrid.selectionBarCount, { count }),
		},
		dataTable: m.dataTable,
		datePicker: m.datePicker,
		dateSelector: m.dateSelector,
		emojiPicker: {
			...m.emojiPicker,
			formatResultCount: (count) => t(m.emojiPicker.formatResultCount, { count }),
			formatSelected: (label) => t(m.emojiPicker.formatSelected, { label }),
			skinTones: SkinTonesSchema.parse(m.emojiPicker.skinTones),
			formatLabel: (label) => (CAPITALISES_NAMES[language] ? label.charAt(0).toLocaleUpperCase(language) + label.slice(1) : label),
		},
		eventCalendar: {
			...m.eventCalendar,
			labels: {
				...m.eventCalendar.labels,
				more: (count) => t(m.eventCalendar.labels.more, { count }),
				events: (count) => t(m.eventCalendar.labels.events, { count }),
				week: (weekNumber) => t(m.eventCalendar.labels.week, { weekNumber }),
				timeFrom: (time) => t(m.eventCalendar.labels.timeFrom, { time }),
				timeUntil: (time) => t(m.eventCalendar.labels.timeUntil, { time }),
				eventDetails: (title) => t(m.eventCalendar.labels.eventDetails, { title }),
				moreCompact: (count) => t(m.eventCalendar.labels.moreCompact, { count }),
				timeRange: (from, to) => t(m.eventCalendar.labels.timeRange, { from, to }),
				eventLabel: (title, time) => t(m.eventCalendar.labels.eventLabel, { title, time }),
				eventAriaLabel: (title, time, continues) =>
					continues === null
						? t(m.eventCalendar.labels.eventAriaLabel.plain, { title, time })
						: t(m.eventCalendar.labels.eventAriaLabel.continues, { title, time, continues }),
				eventMoved: (title, time) => t(m.eventCalendar.labels.eventMoved, { title, time }),
			},
			viewNames: {
				...m.eventCalendar.viewNames,
				days: (count) => t(m.eventCalendar.viewNames.days, { count }),
			},
		},
		gantt: {
			...m.gantt,
			events: (count) => t(m.gantt.events, { count }),
			week: (weekNumber) => t(m.gantt.week, { weekNumber }),
			jumpToBar: (title) => t(m.gantt.jumpToBar, { title }),
			progress: (percent) => t(m.gantt.progress, { percent }),
			summaryProgress: (percent) => t(m.gantt.summaryProgress, { percent }),
			durationDays: (days) => t(m.gantt.durationDays, { days }),
			planned: (rangeLabel) => t(m.gantt.planned, { rangeLabel }),
			announceUpdate: (title, timeLabel) => t(m.gantt.announceUpdate, { title, timeLabel }),
			announceReorder: (title) => t(m.gantt.announceReorder, { title }),
			weekGroup: (weekLabel, rangeLabel) => t(m.gantt.weekGroup, { weekLabel, rangeLabel }),
		},
		dialog: m.dialog,
		kpiDirection: m.kpiDirection,
		listPager: {
			...m.listPager,
			position: (page, totalPages) => (totalPages === null ? t(m.listPager.position.page, { page }) : t(m.listPager.position.pageOfTotal, { page, totalPages })),
		},
		lockoutCountdown: m.lockoutCountdown,
		networkQuality: {
			...m.networkQuality,
			pingValue: (pingMs) => t(m.networkQuality.pingValue, { pingMs }),
			triggerAriaLabel: (state) => t(m.networkQuality.triggerAriaLabel, { state }),
			lastTest: (time) => t(m.networkQuality.lastTest, { time }),
		},
		pagination: m.pagination,
		panelSidebarNav: {
			...m.panelSidebarNav,
			moveSectionUpAriaLabel: (sectionTitle) => t(m.panelSidebarNav.moveSectionUpAriaLabel, { sectionTitle }),
			moveSectionDownAriaLabel: (sectionTitle) => t(m.panelSidebarNav.moveSectionDownAriaLabel, { sectionTitle }),
			routeAnnouncement: (pageLabel) => t(m.panelSidebarNav.routeAnnouncement, { pageLabel }),
		},
		passwordInput: m.passwordInput,
		passwordStrengthMeter: m.passwordStrengthMeter,
		scrollToTop: m.scrollToTop,
		select: {
			...m.select,
			removeOption: (value) => t(m.select.removeOption, { value }),
			selectedOne: (label) => t(m.select.selectedOne, { label }),
			selectedMany: (count, labels) => t(m.select.selectedMany, { count, labels }),
		},
		sheet: m.sheet,
		shellThemeToggle: m.shellThemeToggle,
		shellLanguageToggle: m.shellLanguageToggle,
		sidebar: m.sidebar,
		skeletonRegion: m.skeletonRegion,
		timePicker: m.timePicker,
		timeSeriesChart: m.timeSeriesChart,
		toast: {
			...m.toast,
			countdown: (seconds) => t(m.toast.countdown, { seconds }),
		},
		autocomplete: m.autocomplete,
		numberField: m.numberField,
		phoneInput: {
			...m.phoneInput,
			countrySelect: (country) => t(m.phoneInput.countrySelect, { country }),
		},
		rating: {
			...m.rating,
			value: (rating, maxRating) => t(m.rating.value, { rating, maxRating }),
			star: (star, maxRating) => t(m.rating.star, { star, maxRating }),
		},
		fileType: {
			...m.fileType,
			typeFile: (type) => t(m.fileType.typeFile, { type }),
			labelledType: (label, typeName) => t(m.fileType.labelledType, { label, typeName }),
		},
		kanban: {
			...m.kanban,
			pickedUp: (id) => t(m.kanban.pickedUp, { id }),
			movedOver: (id, overId) => t(m.kanban.movedOver, { id, overId }),
			movedOutside: (id) => t(m.kanban.movedOutside, { id }),
			dropped: (id, overId) => t(m.kanban.dropped, { id, overId }),
			droppedOutside: (id) => t(m.kanban.droppedOutside, { id }),
			cancelled: (id) => t(m.kanban.cancelled, { id }),
		},
		signaturePad: {
			...m.signaturePad,
			readOnlyStatus: (status) => t(m.signaturePad.readOnlyStatus, { status }),
		},
		sortable: {
			...m.sortable,
			pickedUp: (id) => t(m.sortable.pickedUp, { id }),
			movedOver: (id, overId) => t(m.sortable.movedOver, { id, overId }),
			movedOutside: (id) => t(m.sortable.movedOutside, { id }),
			dropped: (id, overId) => t(m.sortable.dropped, { id, overId }),
			droppedOutside: (id) => t(m.sortable.droppedOutside, { id }),
			cancelled: (id) => t(m.sortable.cancelled, { id }),
		},
		filters: {
			...m.filters,
			moveToGroup: (position) => t(m.filters.moveToGroup, { position }),
			rowLabel: (condition, depth) => t(m.filters.rowLabel, { condition, depth }),
			groupLabel: (description, depth) => t(m.filters.groupLabel, { description, depth }),
			groupAnnouncement: (added) => t(m.filters.groupAnnouncement, { added: String(added) }),
			reorderAnnouncement: (label, position, total) => t(m.filters.reorderAnnouncement, { label, position, total }),
			moveAnnouncement: (label, destination, position, total) => t(m.filters.moveAnnouncement, { label, destination, position, total }),
			combinatorLabel: (word) => t(m.filters.combinatorLabel, { word }),
			chipMenu: (fieldLabel) => t(m.filters.chipMenu, { fieldLabel }),
			filterLabel: (condition) => t(m.filters.filterLabel, { condition }),
			exclusiveAnnouncement: (label, cleared) => t(m.filters.exclusiveAnnouncement, { label, cleared }),
			itemCount: (count) => t(m.filters.itemCount, { count }),
			resultsAnnouncement: (count) => t(m.filters.resultsAnnouncement, { count }),
			stepAnnouncement: (step, label) => t(m.filters.stepAnnouncement, { step, label }),
			countAnnouncement: (count) => t(m.filters.countAnnouncement, { count }),
			valueCount: (count) => t(m.filters.valueCount, { count }),
			valueDetail: (summary, values) => t(m.filters.valueDetail.message, { summary, values: values.join(m.filters.valueDetail.separator) }),
			valueRange: (from, to) => t(m.filters.valueRange, { from, to }),
			rangeFrom: (fieldLabel) => t(m.filters.rangeFrom, { fieldLabel }),
			rangeTo: (fieldLabel) => t(m.filters.rangeTo, { fieldLabel }),
			negated: (operatorLabel) => t(m.filters.negated, { operatorLabel }),
			relativeDate: (date) => relativeDateOf(date),
			issueSummary: (count) => t(m.filters.issueSummary, { count }),
		},
		filterOperators: m.filterOperators,
		questionnaire: {
			...m.questionnaire,
			progress: (current, total) => t(m.questionnaire.progress, { current, total }),
		},
		pdfViewer: {
			...m.pdfViewer,
			failures: { ...m.pdfViewer.failures, too_large: t(m.pdfViewer.failures.too_large, { maxSize: formatBytes(MAX_PDF_VIEWER_FILE_BYTES, { locale: language }) }) },
			frameTitle: (fileName) => t(m.pdfViewer.frameTitle, { fileName }),
		},
		fileUpload: {
			...m.fileUpload,
			fileTooLarge: (fileName, maxSize) => t(m.fileUpload.fileTooLarge, { fileName, maxSize }),
			fileTypeNotAccepted: (fileName) => t(m.fileUpload.fileTypeNotAccepted, { fileName }),
			tooManyFiles: (maxFiles) => t(m.fileUpload.tooManyFiles, { maxFiles }),
			formatSize: (bytes) => formatBytes(bytes, { locale: language }),
		},
	};
}
