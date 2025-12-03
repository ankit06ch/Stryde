# Fix HealthKit Provisioning Profile Error

## The Problem

The provisioning profile was created before HealthKit was added, so it doesn't include HealthKit entitlements.

## Solution: Regenerate Provisioning Profile

### Method 1: Toggle Automatic Signing (Easiest)

1. **Open Xcode** (workspace should be at `ios/punch.xcworkspace`)

2. **Select the project:**

   - Click on **punch** (blue icon) in the left sidebar
   - Select the **punch** target (under TARGETS)

3. **Go to Signing & Capabilities tab**

4. **Force regenerate provisioning profile:**

   - **Uncheck** "Automatically manage signing"
   - Wait 2 seconds
   - **Check** "Automatically manage signing" again
   - Xcode will automatically regenerate the profile with HealthKit support

5. **Verify HealthKit is added:**

   - In the Capabilities section, you should see **HealthKit** listed
   - If not, click **+ Capability** button
   - Search for and add **HealthKit**

6. **Clean and rebuild:**
   - Press **Shift + Cmd + K** (Clean Build Folder)
   - Press **Cmd + B** (Build)
   - Press **Cmd + R** (Run)

### Method 2: Manual Profile Regeneration

If Method 1 doesn't work:

1. **In Xcode:**

   - Go to **Signing & Capabilities**
   - Click the **"i"** (info) icon next to the provisioning profile name
   - Note the profile name

2. **Go to Apple Developer Portal:**

   - Visit: https://developer.apple.com/account/resources/profiles/list
   - Sign in with your Apple Developer account
   - Find the profile for `com.punchrewards.punchrewards`
   - **Delete** it

3. **Back in Xcode:**
   - Uncheck and recheck "Automatically manage signing"
   - Xcode will create a new profile with HealthKit

### Method 3: Use Different Bundle Identifier (If you have access)

If you have access to `com.stryde.stryde` in your developer account:

1. In Xcode → **Signing & Capabilities**
2. Change **Bundle Identifier** from `com.punchrewards.punchrewards` to `com.stryde.stryde`
3. Toggle automatic signing off and on
4. This will create a fresh profile with HealthKit

## Important Notes:

- Make sure you've **agreed to the latest Program License Agreement** at https://developer.apple.com/account
- HealthKit requires a **paid Apple Developer account** ($99/year)
- The provisioning profile must be regenerated after adding any new capability
- Wait a few minutes after regenerating for Apple's servers to sync

