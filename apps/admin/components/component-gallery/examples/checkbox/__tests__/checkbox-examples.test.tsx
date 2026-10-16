// @vitest-environment jsdom
import { CHECKBOX_EXAMPLES } from "@/components/component-gallery/examples/checkbox";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Checkbox", CHECKBOX_EXAMPLES);
