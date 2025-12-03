# Renaming Notes

## Completed
- ✅ Updated app.json package names to com.stryde.stryde
- ✅ Updated AndroidManifest scheme from "punch" to "stryde"
- ✅ Updated all code references from "punch" to "stryde"
- ✅ Removed restaurant-related components and images

## Manual Renaming Required

### iOS (Requires Xcode)
The following iOS folders/files still contain "punch" and need manual renaming:
- `ios/punch/` → `ios/stryde/`
- `ios/punch.xcodeproj/` → `ios/stryde.xcodeproj/`
- `ios/punch.xcworkspace/` → `ios/stryde.xcworkspace/`
- Files inside:
  - `punch.entitlements` → `stryde.entitlements`
  - `punch-Bridging-Header.h` → `stryde-Bridging-Header.h`
  - `punch.xcscheme` → `stryde.xcscheme`

**Note:** These require renaming in Xcode to avoid breaking the build. The project file references need to be updated in Xcode.

### Android (Requires Android Studio)
The following Android folders still contain "punchrewards" and need manual renaming:
- `android/app/src/main/java/com/punchrewards/` → `android/app/src/main/java/com/stryde/`
- Package names in Java/Kotlin files need updating:
  - `com.punchrewards.punchrewards` → `com.stryde.stryde`

**Note:** These require renaming in Android Studio and updating package declarations in all Java/Kotlin files.

### Assets (Optional - can be deleted)
- `assets/Punch_Logos/` - Can be deleted as we're using Feather icons now

## Running Image
Please add a running/jogging image to:
- `assets/images/running.png`

This will be used for all onboarding pages.

