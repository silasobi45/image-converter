# Image Converter (React Native / Expo)

A mobile app that lets you pick an image, then resize it to multiple
sizes and export it in multiple formats (JPEG, PNG, WEBP) in one pass.

## Features
- Pick an image from your photo library or take one with the camera
- Select any combination of sizes: Thumbnail (150px), Small (320px),
  Medium (720px), Large (1080px), or Original
- Select any combination of formats: JPEG, PNG, WEBP
- Converts every size × format combination in one tap
- Preview each output with its dimensions and file size
- Save any (or all) results to your photo library, or share them directly

## Setup

1. Install [Node.js](https://nodejs.org) (LTS) and the Expo CLI:
   ```bash
   npm install -g expo-cli
   ```

2. Install dependencies:
   ```bash
   cd image-converter-app
   npm install
   ```

3. Run the app:
   ```bash
   npx expo start
   ```
   Scan the QR code with the **Expo Go** app on your phone (iOS or
   Android), or press `i` / `a` in the terminal to launch an iOS
   Simulator / Android Emulator.

## Building a standalone app

To produce an installable `.ipa` / `.apk` (instead of running inside
Expo Go), use [EAS Build](https://docs.expo.dev/build/introduction/):
```bash
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
```

## How it works

- **expo-image-picker** — lets the user select or capture an image
- **expo-image-manipulator** — resizes the image and re-encodes it
  into the target format (this is the core "convert" step)
- **expo-file-system** — copies each output to a clean, named file
  and reports its size
- **expo-media-library** — saves finished images to the device's
  photo library
- **expo-sharing** — opens the native share sheet for any result

## Customizing

- Add/remove size presets in the `SIZE_PRESETS` array in `App.js`
- Add/remove formats in the `FORMAT_OPTIONS` array (note: WEBP output
  support depends on the Expo SDK version and platform)
- Adjust JPEG/WEBP compression quality via the `compress` option
  passed to `manipulateAsync` (0 to 1)
