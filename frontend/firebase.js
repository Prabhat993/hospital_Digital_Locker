import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";


// Replace this with your project's customized Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBpGNKlS4DedhnRngAdcROTdo2zVFKru-g",
  authDomain: "hospital-digital-locker.firebaseapp.com",
  projectId: "hospital-digital-locker",
  storageBucket: "hospital-digital-locker.firebasestorage.app",
  messagingSenderId: "1090130379401",
  appId: "1:1090130379401:web:f87eb7d45149e9c90b7c58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);