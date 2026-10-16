// @vitest-environment jsdom
import { PAGINATION_EXAMPLES } from "@/components/component-gallery/examples/pagination";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Pagination", PAGINATION_EXAMPLES);
