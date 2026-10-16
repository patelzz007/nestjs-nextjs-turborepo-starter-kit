// @vitest-environment jsdom
import { KBD_EXAMPLES } from "@/components/component-gallery/examples/kbd";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Kbd", KBD_EXAMPLES);
