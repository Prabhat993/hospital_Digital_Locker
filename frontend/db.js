// db.js
import Dexie from 'dexie';

export const db = new Dexie('HospitalLockerDB');
db.version(1).stores({
  files: 'docId, blob' // Primary key: docId, Data: blob
});