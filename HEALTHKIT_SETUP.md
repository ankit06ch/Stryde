# HealthKit / Apple Watch Setup Guide

## ✅ Completed Steps

1. ✅ Installed `react-native-health` package
2. ✅ Added HealthKit permissions to `Info.plist`
3. ✅ Added HealthKit entitlements to `punch.entitlements`
4. ✅ Updated `app.json` with HealthKit configuration
5. ✅ Installed CocoaPods dependencies (including RNAppleHealthKit)
6. ✅ Created HealthKit utility functions
7. ✅ Added Apple Watch connection component to Profile screen

## 🔧 Manual Steps Required in Xcode

Since HealthKit requires manual configuration in Xcode, follow these steps:

### Step 1: Open Xcode Project
The workspace should already be open. If not:
```bash
cd /Users/ankit/Projects/Stryde/Stryde
open ios/punch.xcworkspace
```

### Step 2: Add HealthKit Capability

1. In Xcode, select the **punch** project in the left sidebar
2. Select the **punch** target
3. Go to the **Signing & Capabilities** tab
4. Click the **+ Capability** button
5. Search for and add **HealthKit**
6. Ensure the HealthKit capability shows as enabled

### Step 3: Verify Entitlements

1. In the **Signing & Capabilities** tab, verify that:
   - HealthKit capability is listed
   - The entitlements file `punch.entitlements` is correctly referenced
   - The bundle identifier matches: `com.stryde.stryde` (or `com.punchrewards.punchrewards`)

### Step 4: Rebuild the App

After adding the capability, rebuild the app:
```bash
cd /Users/ankit/Projects/Stryde/Stryde
pnpm ios
```

## 📱 Testing Apple Watch Connection

1. Run the app on a physical iOS device (HealthKit doesn't work in simulator)
2. Go to the **Profile** screen
3. You should see a "Connect Apple Watch" button
4. Tap it to request HealthKit permissions
5. Grant permissions in the iOS Health app
6. The app will display stats from your Apple Watch:
   - Steps
   - Distance
   - Calories burned
   - Average heart rate

## ⚠️ Important Notes

- **Physical Device Required**: HealthKit only works on physical iOS devices, not simulators
- **Apple Watch**: You need an Apple Watch paired with your iPhone
- **Permissions**: Users must grant HealthKit permissions in Settings > Privacy & Security > Health
- **App Store**: HealthKit requires justification for App Store submission

## 🔍 Troubleshooting

If HealthKit doesn't work:
1. Ensure you're testing on a physical device
2. Check that HealthKit capability is enabled in Xcode
3. Verify entitlements file includes HealthKit
4. Check iOS Settings > Privacy & Security > Health > Stryde
5. Ensure Apple Watch is paired and syncing data


