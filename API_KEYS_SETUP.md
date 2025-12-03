# API Keys Setup Guide

This project requires several API keys to function properly. Follow these steps to configure them:

## Required API Keys

### 1. Gemini API Key
- **Purpose**: AI-powered workout insights and mental notes analysis
- **Where to get it**: https://makersuite.google.com/app/apikey
- **Environment Variable**: `EXPO_PUBLIC_GEMINI_API_KEY`
- **Usage**: Set in `.env` file

### 2. Google Maps API Key
- **Purpose**: Maps display and location services
- **Where to get it**: https://console.cloud.google.com/google/maps-apis
- **Required APIs**: Maps SDK for Android, Maps SDK for iOS
- **Configuration**: 
  - Set in `app.json` under `android.config.googleMaps.apiKey`
  - Set in `android/app/src/main/AndroidManifest.xml` as `com.google.android.geo.API_KEY`
  - Currently set to placeholder: `YOUR_GOOGLE_MAPS_API_KEY_HERE`

### 3. Firebase Configuration
- **Purpose**: Authentication, database, and storage
- **Where to get it**: https://console.firebase.google.com/
- **Environment Variables**:
  - `EXPO_PUBLIC_FIREBASE_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_APP_ID`
- **Usage**: Set in `.env` file or update `firebase/config.js` directly

### 4. Google Places API Key
- **Purpose**: Address autocomplete in signup form
- **Where to get it**: https://console.cloud.google.com/google/maps-apis
- **Required APIs**: Places API
- **Environment Variable**: `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- **Usage**: Set in `.env` file

## Setup Instructions

1. Create a `.env` file in the root directory (it's already in `.gitignore`)

2. Add your API keys to the `.env` file:
```env
# Google API Keys
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id_here
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id_here
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id_here

# Google Places API Key
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

3. Update `app.json`:
   - Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual Google Maps API key

4. Update `android/app/src/main/AndroidManifest.xml`:
   - Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual Google Maps API key

5. Restart your development server after adding environment variables:
```bash
npm start
```

## Security Notes

- ⚠️ **Never commit your `.env` file to git** - it's already in `.gitignore`
- ⚠️ **Never commit API keys directly in code files**
- ⚠️ **Rotate your API keys if they've been exposed**
- ✅ All API keys have been removed from the repository
- ✅ Use environment variables for all sensitive configuration

