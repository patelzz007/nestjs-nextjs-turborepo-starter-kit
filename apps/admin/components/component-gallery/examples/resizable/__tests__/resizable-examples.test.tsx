// @vitest-environment jsdom
import { RESIZABLE_EXAMPLES } from "@/components/component-gallery/examples/resizable";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Resizable", RESIZABLE_EXAMPLES);
