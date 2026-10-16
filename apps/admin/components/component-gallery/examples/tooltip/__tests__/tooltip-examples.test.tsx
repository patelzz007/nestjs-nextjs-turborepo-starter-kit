// @vitest-environment jsdom
import { TOOLTIP_EXAMPLES } from "@/components/component-gallery/examples/tooltip";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Tooltip", TOOLTIP_EXAMPLES);
