#!/usr/bin/env node
/**
 * Seeds the 11 rooms for Rosy Morn into Firestore.
 * Run once: node src/scripts/seedRooms.js
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, '../../firebase-service-account.json'), 'utf8')
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const rooms = [
  { number: 1, name: 'Room 1', floor: 'Ground', type: 'single' },
  { number: 2, name: 'Room 2', floor: 'Ground', type: 'single' },
  { number: 3, name: 'Room 3', floor: 'Ground', type: 'double' },
  { number: 4, name: 'Room 4', floor: 'First', type: 'single' },
  { number: 5, name: 'Room 5', floor: 'First', type: 'single' },
  { number: 6, name: 'Room 6', floor: 'First', type: 'double' },
  { number: 7, name: 'Room 7', floor: 'First', type: 'single' },
  { number: 8, name: 'Room 8', floor: 'Second', type: 'single' },
  { number: 9, name: 'Room 9', floor: 'Second', type: 'double' },
  { number: 10, name: 'Room 10', floor: 'Second', type: 'single' },
  { number: 11, name: 'Room 11', floor: 'Second', type: 'single' },
];

async function seed() {
  const existing = await db.collection('rooms').get();
  if (!existing.empty) {
    console.log(`Rooms already seeded (${existing.size} found). Skipping.`);
    process.exit(0);
  }

  const batch = db.batch();
  for (const room of rooms) {
    const ref = db.collection('rooms').doc();
    batch.set(ref, { ...room, created_at: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  console.log(`Seeded ${rooms.length} rooms.`);
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
