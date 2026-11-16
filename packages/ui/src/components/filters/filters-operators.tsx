// The filter bar's operators rules: shared with the native kit (@workspace/ui-kit-logic `filters`), re-exported for the
// web kit's modules and consumers.

export {
	coerceFilterValue,
	createFilterOperators,
	DEFAULT_FILTER_ARITY,
	DEFAULT_FILTER_VALUE_TYPE,
	FILTER_BUILT_IN_OPERATORS,
	FILTER_OPERATOR_CATALOG,
	FilterBuiltInOperatorSchema,
	getDefaultFilterOperator,
	getFilterArity,
	getFilterOperator,
	negateFilterOperator,
	operatorTakesValue,
	resolveFilterOperators,
	visibleFilterOperators,
	type FilterBuiltInOperator,
	type FilterNegation,
	type FilterOperatorCatalogEntry,
	type FilterOperatorLabels,
	type FilterOperatorSource,
} from "@workspace/ui-kit-logic";
