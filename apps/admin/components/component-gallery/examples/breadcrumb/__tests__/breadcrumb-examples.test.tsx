// @vitest-environment jsdom
import { BREADCRUMB_EXAMPLES } from "@/components/component-gallery/examples/breadcrumb";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Breadcrumb", BREADCRUMB_EXAMPLES);
