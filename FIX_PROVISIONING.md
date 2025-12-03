# Fix Provisioning Profile for HealthKit

## Steps to Fix:

### 1. Agree to Program License Agreement
1. Go to https://developer.apple.com/account
2. Sign in with your Apple Developer account
3. If prompted, agree to the latest Program License Agreement
4. Wait a few minutes for it to propagate

### 2. Regenerate Provisioning Profile in Xcode

**Option A: Automatic (Recommended)**
1. Open Xcode
2. Select the **punch** project → **punch** target
3. Go to **Signing & Capabilities** tab
4. **Uncheck** "Automatically manage signing"
5. **Check** "Automatically manage signing" again
6. This will force Xcode to regenerate the provisioning profile with HealthKit support

**Option B: Manual**
1. In Xcode, go to **Signing & Capabilities**
2. Click the **"i"** icon next to the provisioning profile
3. Click **"Download Manual Profiles"**
4. Or go to https://developer.apple.com/account/resources/profiles/list
5. Delete the old provisioning profile for `com.punchrewards.punchrewards`
6. Xcode will automatically create a new one with HealthKit support

### 3. Verify HealthKit Capability
1. In **Signing & Capabilities**, ensure **HealthKit** is listed
2. If not, click **+ Capability** and add **HealthKit**
3. The provisioning profile should automatically update

### 4. Clean and Rebuild
1. In Xcode: **Product → Clean Build Folder** (Shift + Cmd + K)
2. **Product → Build** (Cmd + B)
3. Then **Product → Run** (Cmd + R)

## Note:
The bundle identifier is `com.punchrewards.punchrewards` in Xcode. Make sure your Apple Developer account has access to this bundle ID, or update it to match your app.json (`com.stryde.stryde`).


