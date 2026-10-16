// @vitest-environment jsdom
import { INPUT_EXAMPLES } from "@/components/component-gallery/examples/input";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Input", INPUT_EXAMPLES);
