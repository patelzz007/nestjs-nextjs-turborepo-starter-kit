import { isStringPrimitive } from "@workspace/shared";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import type { CascaderLabels } from "@workspace/ui/components/cascader/cascader-types";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/**
 * The cascader's copy is the `cascader` family of `UiKitLabels` — the kit's one
 * i18n mechanism. An app translates it once in its language pack; a single
 * `Cascader` overrides individual strings through its `labels` prop.
 */
export function useCascaderLabels(override?: UiKitLabelsOverride<"cascader">): CascaderLabels {
	return useUiKitLabels("cascader", override);
}

/** Resolves the search placeholder, which may be a string or a function of the level's parent label. */
export function resolveCascaderSearchLabel(labels: CascaderLabels, parentLabel?: string): string {
	const { search } = labels;
	return isStringPrimitive(search) ? search : search(parentLabel);
}
