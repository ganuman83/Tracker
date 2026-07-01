# Tracker App — Setup Guide

A personal tracker web app with Google Sign-In and Firestore cloud sync.
Three modules: **Habit Tracker**, **Exercise Planner**, **Expense Tracker**.

---

## Files

```
tracker-app/
├── index.html          ← Main HTML shell + all page markup
├── styles.css          ← All styles (login screen + app)
├── app.js              ← Firebase auth, Firestore sync, all page logic
├── firebase-config.js  ← 🔧 YOU FILL THIS IN (see Step 4 below)
└── README.md
```

---

## One-Time Firebase Setup (takes ~5 minutes)

### Step 1 — Create / reuse a Firebase project
Go to https://console.firebase.google.com
Click **Add project** (or reuse your MusicPro/MauliEnt project).

### Step 2 — Enable Google Sign-In
- Sidebar → **Build > Authentication** → **Get started**
- **Sign-in method** tab → click **Google** → toggle **Enable** → Save

### Step 3 — Create Firestore Database
- Sidebar → **Build > Firestore Database** → **Create database**
- Choose **Production mode** → pick your region → Done
- Go to the **Rules** tab and replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Click **Publish**.

### Step 4 — Copy your Firebase config into firebase-config.js
- Firebase Console → gear icon ⚙️ → **Project settings**
- Scroll to **Your apps** → click **</>** (web) → Register app (no hosting needed)
- Firebase shows you a `firebaseConfig` object. Copy those values into `firebase-config.js`.

### Step 5 — Add your domain to Authorized Domains
*(Only needed when hosting online, e.g. GitHub Pages)*
- **Authentication** → **Settings** → **Authorized domains**
- Click **Add domain** → enter your domain (e.g. `yourname.github.io`)

---

## Running Locally

Because the app uses ES Modules (`type="module"`), you need a local web server —
opening `index.html` directly as a file:// URL won't work.

**Easiest options:**

```bash
# Option A — Python (built-in, no install needed)
cd tracker-app
python3 -m http.server 5500
# then open http://localhost:5500

# Option B — Node http-server
npx http-server . -p 5500
# then open http://localhost:5500

# Option C — VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

---

## Hosting Online (GitHub Pages — free)

1. Create a new GitHub repo (or use an existing one).
2. Drop all 4 files into the repo root.
3. Repo Settings → **Pages** → Source: `main` branch / `root` folder → Save.
4. Your app will be live at `https://<username>.github.io/<repo-name>/`
5. Add that URL as an Authorized Domain in Firebase (Step 5 above).

---

## How data is stored

- Each user gets one Firestore document at `users/{uid}`.
- Every change auto-saves to Firestore within ~600 ms (debounced).
- The sync status (Saved / Saving… / Error) is shown at the bottom of the sidebar.
- Data is private per user — Firestore rules block access to other users' documents.
