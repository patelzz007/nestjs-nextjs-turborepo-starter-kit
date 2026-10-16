// @vitest-environment jsdom
import { HOVER_CARD_EXAMPLES } from "@/components/component-gallery/examples/hover-card";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Hover Card", HOVER_CARD_EXAMPLES);
