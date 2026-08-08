
# DREAMSheet AI — Flourish Coaching Platform MVP

DREAMSheet AI is a web-based coaching support platform built for the Flourish beta. The application helps users move through a structured coaching journey using the D.R.E.A.M. framework:

- **D**omains
- **R**atings
- **E**nd-goals
- **A**ffirmations
- **M**asterplan

The current version is an MVP intended for beta testing by a small group of coaches.

---

## Live Vercel Deployment

The current beta/MVP version of the website can be accessed on Vercel here:

https://dreamsheet-ai-mvp.vercel.app/

---

## Current MVP Features

- AI-assisted domain identification
- Coaching discovery questions
- Focus area generation and selection
- Manual fallback domains if AI suggestions fail
- Manual fallback focus areas if AI suggestions fail
- Manual focus area addition
- End-goal and action planning flow
- “Ongoing” option for open-ended goals/action steps
- Improved mobile scrolling and layout handling
- Flourish/DREAMSheet header logo integration
- AI loading and failure feedback
- Local browser persistence using `localStorage`
- Vercel deployment support

---

## Tech Stack

- **React**
- **Vite**
- **TypeScript**
- **Tailwind CSS**
- **Google Gemini API**
- **Vercel**

---

## Project Structure

```txt
src/
├── App.tsx                  # Main application flow and UI
├── main.tsx                 # React entry point
├── types.ts                 # Shared TypeScript types
├── services/
│   └── coachingService.ts   # AI/Gemini-related functions
├── components/
│   └── WaterfallRoadmap.tsx # Roadmap/timeline visualisation
└── index.css                # Global styles

public/
└── flourish-logo.png        # Current logo asset
````

---

## Run Locally

### Prerequisites

Install Node.js before running the project.

### 1. Install dependencies

```bash
npm install
```

### 2. Add environment variables

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not commit `.env.local` to GitHub.

### 3. Start the development server

```bash
npm run dev
```

The app should run locally at:

```txt
http://localhost:3000
```

or the local URL shown in the terminal.

---

## Build

To create a production build:

```bash
npm run build
```

To run TypeScript/lint checks:

```bash
npm run lint
```

---

## Deployment

The app is deployed on Vercel.

Recommended Vercel settings:

```txt
Framework: Vite
Build command: npm run build
Output directory: dist
```

The following environment variable should be added in Vercel Project Settings:

```txt
GEMINI_API_KEY
```

The API key should be stored in Vercel environment variables and should not be hardcoded into the source code.

---

## Backend Status

The current MVP is frontend-focused.

At the moment, the app uses browser `localStorage` for local persistence. The next planned phase is to connect a free-tier Supabase backend so that submitted user data can be stored and reviewed from the Supabase dashboard.

Planned backend data includes:

* user/client name
* coach name
* quiz answers
* discovery responses
* selected domains
* focus areas
* ratings
* goals
* affirmations
* action steps
* timestamps

For the first backend MVP, submitted data can be stored in Supabase and reviewed through the Supabase dashboard. A dedicated in-app admin dashboard can be added later if required.

---

## Current MVP Notes

This beta version is designed so that the user flow does not get blocked if AI suggestions fail. If the Gemini API is unavailable or returns an invalid response, the app provides fallback domains/focus areas and allows manual continuation.

This makes the application suitable for early coach testing even when AI responses are temporarily unavailable.

---

## Important Security Notes

* Do not commit `.env.local`
* Do not hardcode API keys
* Use Vercel environment variables for deployed secrets
* Use a project/client-owned API key for production testing where possible
* Keep backend service keys private and never expose them in frontend code

---

## Development Status

Current MVP branch:

```txt
ui-fixes-logo-mvp
```

Recent completed work:

* UI and mobile layout fixes
* Header/logo update
* AI failure feedback
* Manual fallback domains and focus areas
* Flow unblocking when AI suggestions fail
* “Ongoing” option support
* Vercel deployment test

---

## Planned Next Phase

The next development phase is backend integration using Supabase.

Planned work:

* Create Supabase project
* Add database table for submitted plans
* Store full coaching submission data
* Keep localStorage as fallback
* Add Vercel environment variables for Supabase
* Allow admin review through Supabase dashboard
* Later improve into a dedicated in-app admin dashboard

````

Then run:

```bash
git add README.md
git commit -m "Update README for DREAMSheet AI MVP"
git push
````
