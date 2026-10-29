# R8 keep rules for an Android RELEASE build. The config plugin next to this file
# (release-keep-rules.ts) adds it to the release build's ProGuard files. A debug build is not
# minified, which is why both problems below only ever showed in a release APK / AAB.

# 1. Native error codes. An Expo module error without an explicit code takes it from its class
#    name at runtime (expo-modules-core CodedException.inferCode: `BarcodeScanningFailedException`
#    becomes `ERR_BARCODE_SCANNING_FAILED`). R8 renames those classes, and merges ones that look
#    alike, so a release build reported codes like `ERR_T30`: closing Google's scanner then read as
#    "scanner unavailable" (the camera scanner opened instead), and the PDF viewer's
#    ERR_PDF_PASSWORD_PROTECTED / ERR_PDF_UNSUPPORTED / … became unknown codes. The classes are
#    kept whole, not only their names: `-keepnames` still lets R8 merge one exception class into
#    another (it counts as removing it), which is what had happened to expo-camera's
#    BarcodeScanningFailedException and BarcodeScanningCancelledException.
-keep class * extends expo.modules.kotlin.exception.CodedException
#    The code is built from the class's SIMPLE name. For a nested class (expo-camera's are nested in
#    `CameraExceptions`) Java reads that name from the InnerClasses attribute, which R8 strips; without
#    it the simple name is the binary one, `CameraExceptions$BarcodeScanningFailedException`, and the
#    code became `ERR_CAMERA_EXCEPTIONS$_BARCODE_SCANNING_FAILED` (seen in a shrunk build's log).
#    R8 writes that attribute only while the OUTER class exists too, and nothing uses the outer
#    holder (`CameraExceptions`) itself, so it is kept as well: Expo names these holders
#    `…Exceptions` (expo-camera's CameraExceptions, expo-modules-core's Exceptions).
-keepattributes InnerClasses,EnclosingMethod
-keep class expo.modules.**Exceptions

# 2. ML Kit's scanners. Before it opens one, expo-camera checks that the ML Kit library is in the
#    app by looking its entry point up BY NAME (CameraUtils: Class.forName of
#    "com.google.mlkit.vision.barcode.BarcodeScanning", and of
#    "com.google.mlkit.vision.documentscanner.GmsDocumentScanning" for the document scanner). No code
#    refers to those classes directly, so R8 removed them, and every release build rejected
#    `launchScanner` with ERR_M_L_KIT_UNAVAILABLE and fell back to the camera scanner. Every ML Kit
#    scanner entry point is named `…Scanning`; only those classes (and their names) are kept, the
#    rest of ML Kit is still shrunk under the consumer rules it ships.
-keep class com.google.mlkit.vision.**Scanning
