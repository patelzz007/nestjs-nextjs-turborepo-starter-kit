// @vitest-environment jsdom
import { ACCORDION_EXAMPLES } from "@/components/component-gallery/examples/accordion";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Accordion", ACCORDION_EXAMPLES);
