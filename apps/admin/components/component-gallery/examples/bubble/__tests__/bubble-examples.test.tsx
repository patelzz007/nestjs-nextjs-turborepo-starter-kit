// @vitest-environment jsdom
import { BUBBLE_EXAMPLES } from "@/components/component-gallery/examples/bubble";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Bubble", BUBBLE_EXAMPLES);
