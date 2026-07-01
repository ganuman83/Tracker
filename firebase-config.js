// ============================================================
// FIREBASE CONFIG
// ------------------------------------------------------------
// Get these values from: Firebase Console > Project Settings
// > General > Your apps > SDK setup and configuration
//
// Steps to set this app up (one-time):
// 1. Go to https://console.firebase.google.com and create a project
//    (or reuse an existing one, e.g. the one you used for MusicPro/MauliEnt).
// 2. Build > Authentication > Get started > Sign-in method
//    > enable "Google" as a sign-in provider.
// 3. Build > Firestore Database > Create database
//    > start in "Production mode" (we add proper rules below).
// 4. Project settings (gear icon) > General > scroll to "Your apps"
//    > click the </> (web) icon > register an app (no hosting needed)
//    > copy the firebaseConfig object Firebase shows you and paste
//    the values below.
// 5. Firestore > Rules tab, paste this and Publish:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }
//
// 6. (Optional, for deploying) Authentication > Settings > Authorized domains
//    > add the domain you host this on (e.g. yourname.github.io).
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyC5WK489wOBp-KNH5Rj_RC0aZGog6eg4NE",
  authDomain: "tracker-3b27a.firebaseapp.com",
  projectId: "tracker-3b27a",
  storageBucket: "tracker-3b27a.firebasestorage.app",
  messagingSenderId: "563250476125",
  appId: "1:563250476125:web:7b5938e69bd651bd8589b4",
  measurementId: "G-LZB6LPF04N"
};