// TEMPORARY — the old data-grid names, kept only for the native kit (`@workspace/ui-native`) until it moves to the
// unified table (docs/architecture/data-table-unification-plan.md, Part C). The web kit uses the `TableEngine*` names
// from `../table` and `../spreadsheet`. Delete this file with the native `data-grid` components.

export {
	TABLE_ENGINE_CLIPBOARD_LINE_BREAK as DATA_GRID_CLIPBOARD_LINE_BREAK,
	TABLE_ENGINE_CLIPBOARD_QUOTE_NEEDED as DATA_GRID_CLIPBOARD_QUOTE_NEEDED,
	escapeTableEngineClipboardHtml as escapeDataGridClipboardHtml,
	parseTableEngineClipboardText as parseDataGridClipboardText,
	renderTableEngineClipboardHtml as renderDataGridClipboardHtml,
	serializeTableEngineClipboardField as serializeDataGridClipboardField,
	serializeTableEngineClipboardText as serializeDataGridClipboardText,
	tileTableEngineClipboardBlock as tileDataGridClipboardBlock,
} from "../spreadsheet/table-engine-clipboard";
export {
	TABLE_ENGINE_MESSAGES_EN as DATA_GRID_MESSAGES_EN,
	buildTableEngineLabels as buildDataGridLabels,
	type TableEngineLabels as DataGridLabels,
	type TableEngineMessageFormatter as DataGridMessageFormatter,
	type TableEngineMessages as DataGridMessages,
	type TableEnginePaginationInfo as DataGridPaginationInfo,
} from "../table/table-engine-messages";
