// @vitest-environment jsdom
import { LABEL_EXAMPLES } from "@/components/component-gallery/examples/label";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Label", LABEL_EXAMPLES);
