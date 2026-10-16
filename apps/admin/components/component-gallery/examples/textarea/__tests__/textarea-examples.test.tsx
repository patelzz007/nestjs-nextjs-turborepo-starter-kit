// @vitest-environment jsdom
import { TEXTAREA_EXAMPLES } from "@/components/component-gallery/examples/textarea";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Textarea", TEXTAREA_EXAMPLES);
