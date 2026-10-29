# The app's own PDF page renderer (apps/mobile/modules/pdf-renderer, ADR 056):
# PDFKit, which iOS ships — no third-party PDF library.
Pod::Spec.new do |s|
  s.name           = 'PdfRenderer'
  s.version        = '1.0.0'
  s.summary        = 'Renders PDF pages to PNG files with PDFKit.'
  s.description    = 'A local Expo module of the starter app: opens a PDF and renders one page at a time with PDFKit.'
  s.license        = 'UNLICENSED'
  s.author         = 'Starter'
  s.homepage       = 'https://github.com/expo/expo'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
