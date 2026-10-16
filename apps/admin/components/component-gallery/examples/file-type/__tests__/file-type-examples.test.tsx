// @vitest-environment jsdom
import { FILE_TYPE_EXAMPLES } from "@/components/component-gallery/examples/file-type";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("File Type", FILE_TYPE_EXAMPLES);
