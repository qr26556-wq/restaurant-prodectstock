#!/usr/bin/env bash
set -euo pipefail

# Simple deploy helper for feature/customer-orders
# Usage: ./scripts/deploy-firebase.sh <PROJECT_ID>
# Requirements:
#  - firebase-tools installed and authenticated (firebase login)
#  - this script run from repo root
#  - invited deployer must have Editor role on the Firebase project

PROJECT_ID="$1"
if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <PROJECT_ID>" >&2
  exit 2
fi

echo "Checking git branch..."
git fetch origin
if git rev-parse --verify --quiet feature/customer-orders >/dev/null; then
  git checkout feature/customer-orders
else
  git checkout -b feature/customer-orders origin/feature/customer-orders || git checkout feature/customer-orders
fi

echo "Deploying Realtime Database rules..."
if [ ! -f database.rules.json ]; then
  echo "database.rules.json not found in repo root. Please create it from FIREBASE_RULES.md before running this script." >&2
  exit 3
fi

firebase deploy --only database:rules --project "$PROJECT_ID"

echo "Deploying Cloud Functions..."
cd functions
npm install --no-audit --no-fund
firebase deploy --only functions --project "$PROJECT_ID"
cd -

echo "Done."
echo "Next steps: set FIREBASE_CONFIG and (optionally) FIREBASE_VAPID_KEY in your hosting (Vercel/Netlify) and redeploy the static site. Then test sign-in and placing an order." 
