// @vitest-environment jsdom
import { SCROLLSPY_EXAMPLES } from "@/components/component-gallery/examples/scrollspy";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Scrollspy", SCROLLSPY_EXAMPLES);
