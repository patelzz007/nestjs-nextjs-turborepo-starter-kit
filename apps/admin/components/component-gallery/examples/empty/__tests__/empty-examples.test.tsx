// @vitest-environment jsdom
import { EMPTY_EXAMPLES } from "@/components/component-gallery/examples/empty";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Empty", EMPTY_EXAMPLES);
