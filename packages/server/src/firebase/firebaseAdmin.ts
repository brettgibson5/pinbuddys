import * as admin from "firebase-admin";
import type { MatchRecord } from "@pinbuddys/shared";
import { FIRESTORE } from "@pinbuddys/shared";

let initialized = false;

function getApp(): admin.app.App {
  if (!initialized) {
    // Expects FIREBASE_SERVICE_ACCOUNT env var with base64-encoded service account JSON,
    // OR a GOOGLE_APPLICATION_CREDENTIALS file path for GCP-hosted deployments.
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountBase64) {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, "base64").toString("utf8")
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Falls back to Application Default Credentials
      admin.initializeApp();
    }
    initialized = true;
  }
  return admin.app();
}

export async function saveMatchResult(match: MatchRecord): Promise<void> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn("[Firebase] No credentials configured — skipping match save");
    return;
  }

  const db = getApp().firestore();
  const batch = db.batch();

  // Write the match document
  const matchRef = db.collection(FIRESTORE.MATCHES).doc(match.matchId);
  batch.set(matchRef, match);

  // Increment winner stats
  if (match.winnerId) {
    const winnerRef = db.collection(FIRESTORE.USERS).doc(match.winnerId);
    batch.update(winnerRef, {
      wins: admin.firestore.FieldValue.increment(1),
      points: admin.firestore.FieldValue.increment(3),
    });

    const loserId = match.p1Uid === match.winnerId ? match.p2Uid : match.p1Uid;
    if (loserId) {
      const loserRef = db.collection(FIRESTORE.USERS).doc(loserId);
      batch.update(loserRef, {
        losses: admin.firestore.FieldValue.increment(1),
      });
    }
  }

  await batch.commit();
  console.log(`[Firebase] Match ${match.matchId} saved`);
}
