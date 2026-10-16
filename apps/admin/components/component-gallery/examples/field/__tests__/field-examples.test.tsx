// @vitest-environment jsdom
import { FIELD_EXAMPLES } from "@/components/component-gallery/examples/field";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Field", FIELD_EXAMPLES);
