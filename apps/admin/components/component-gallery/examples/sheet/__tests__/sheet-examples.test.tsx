// @vitest-environment jsdom
import { SHEET_EXAMPLES } from "@/components/component-gallery/examples/sheet";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Sheet", SHEET_EXAMPLES);
