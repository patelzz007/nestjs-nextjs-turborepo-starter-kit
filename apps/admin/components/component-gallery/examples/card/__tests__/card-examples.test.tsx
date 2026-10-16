// @vitest-environment jsdom
import { CARD_EXAMPLES } from "@/components/component-gallery/examples/card";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Card", CARD_EXAMPLES);
