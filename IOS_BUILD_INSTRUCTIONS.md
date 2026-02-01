# Cyber-shot Booth - iOS App Build Instructions

## Overview
This document provides step-by-step instructions to build and publish the Cyber-shot Booth iOS app to the App Store.

## Prerequisites

1. **Mac computer** with macOS Monterey (12.0) or later
2. **Xcode 15** or later (download from Mac App Store)
3. **Apple Developer Account** ($99/year) - required for App Store publishing
4. **CocoaPods** (optional, Capacitor uses Swift Package Manager by default)

## Project Setup

### Step 1: Download the Project

Download the entire `photobooth-app` folder to your Mac.

### Step 2: Install Dependencies

Open Terminal and navigate to the project folder:

```bash
cd /path/to/photobooth-app
npm install
# or
pnpm install
```

### Step 3: Build the Web App

```bash
npm run build
# or
pnpm run build
```

### Step 4: Sync iOS Project

```bash
npx cap sync ios
```

## Opening in Xcode

### Step 5: Open the iOS Project

```bash
npx cap open ios
```

This will open the Xcode project. Alternatively, you can manually open:
`photobooth-app/ios/App/App.xcworkspace`

## Xcode Configuration

### Step 6: Configure Signing

1. In Xcode, select the **App** project in the navigator
2. Select the **App** target
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** (your Apple Developer account)
6. Update the **Bundle Identifier** if needed (currently: `com.cybershotbooth.app`)

### Step 7: Update App Version

1. In the **General** tab
2. Set **Version** (e.g., 1.0.0)
3. Set **Build** (e.g., 1)

### Step 8: Configure App Icons

App icons have been pre-generated and placed in:
`ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Verify all icons appear correctly in Xcode's asset catalog.

## Testing

### Step 9: Test on Simulator

1. Select an iPhone simulator from the device dropdown
2. Click the **Play** button (▶) to build and run
3. Test all features:
   - Camera access
   - Photo capture
   - Sticker placement
   - Save to gallery
   - Share functionality

### Step 10: Test on Physical Device

1. Connect your iPhone via USB
2. Select your device from the dropdown
3. Build and run
4. Trust the developer certificate on your iPhone:
   - Settings → General → VPN & Device Management → Trust

## App Store Submission

### Step 11: Create App Store Connect Entry

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Cyber-shot Booth
   - **Primary Language**: English
   - **Bundle ID**: com.cybershotbooth.app
   - **SKU**: cybershotbooth001

### Step 12: Prepare App Metadata

Required assets:
- **App Icon**: 1024x1024 PNG (already generated)
- **Screenshots**: 
  - iPhone 6.7" (1290 x 2796)
  - iPhone 6.5" (1284 x 2778)
  - iPhone 5.5" (1242 x 2208)
  - iPad Pro 12.9" (2048 x 2732)
- **Description**: Write a compelling app description
- **Keywords**: photobooth, camera, retro, film strip, stickers
- **Privacy Policy URL**: Required for camera access

### Step 13: Archive and Upload

1. In Xcode, select **Product** → **Archive**
2. Wait for the archive to complete
3. In the Organizer window, click **Distribute App**
4. Select **App Store Connect** → **Upload**
5. Follow the prompts to upload

### Step 14: Submit for Review

1. In App Store Connect, go to your app
2. Add the uploaded build
3. Complete all required information
4. Click **Submit for Review**

## Permissions Explained

The app requests these permissions (already configured in Info.plist):

| Permission | Reason |
|------------|--------|
| Camera | Required to take photos |
| Photo Library | Required to save photos to gallery |
| Photo Library Add | Required to add photos to gallery |

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
cd ios/App
rm -rf Pods Podfile.lock
pod install
```

### Camera Not Working

Ensure the app has camera permissions in iOS Settings.

### Photos Not Saving

Check that photo library permissions are granted in iOS Settings.

## App Information

- **App Name**: Cyber-shot Booth
- **Bundle ID**: com.cybershotbooth.app
- **Version**: 1.0.0
- **Minimum iOS**: 14.0
- **Supported Devices**: iPhone, iPad

## Support

For issues with the app code, check the browser console in Safari's Web Inspector:
1. Enable Web Inspector on your iPhone (Settings → Safari → Advanced)
2. Connect to Mac and open Safari
3. Develop menu → Your iPhone → App

---

*Generated for Cyber-shot Booth iOS App*
