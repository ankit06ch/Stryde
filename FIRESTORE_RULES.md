# Firestore Security Rules

You need to set these security rules in your Firebase Console to allow signup and data access.

## Steps to Update Rules:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **stride-3b661**
3. Go to **Firestore Database** → **Rules** tab
4. Replace the existing rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection - users can read/write their own data, create their own document
    match /users/{userId} {
      // Allow users to read their own data
      allow read: if isOwner(userId);

      // Allow users to create their own document during signup
      allow create: if isAuthenticated() && request.auth.uid == userId;

      // Allow users to update their own data
      allow update: if isOwner(userId);

      // Allow users to delete their own account
      allow delete: if isOwner(userId);
    }

    // Workouts collection - users can create and read their own workouts
    match /workouts/{workoutId} {
      // Allow users to read their own workouts
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;

      // Allow users to create workouts
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;

      // Allow users to update their own workouts
      allow update: if isAuthenticated() &&
                       resource.data.userId == request.auth.uid &&
                       request.resource.data.userId == request.auth.uid;

      // Allow users to delete their own workouts
      allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // Allow reading other users' public data (for following/followers features)
    match /users/{userId} {
      allow read: if isAuthenticated();
    }

    // Deny all other access by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Quick Test Rules (Development Only - Less Secure)

If you want to test quickly during development, you can use these less secure rules (⚠️ **DO NOT USE IN PRODUCTION**):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Important:** The test rules allow any authenticated user to read/write any document. Only use this for development and testing. Switch to the secure rules above before going to production.

## After Updating Rules:

1. Click **Publish** to save the rules
2. Rules take effect immediately
3. Try signing up again - it should work now!
