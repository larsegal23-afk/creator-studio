// firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzNqEXGDYnyyaxyi_dEkWR8ek3fsoMhFA",
  authDomain: "logomakergermany-kreativtool.firebaseapp.com",
  projectId: "logomakergermany-kreativtool"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firebase Auth Ready Promise
window.firebaseAuthReady = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    resolve();
  });
});

window.firebaseAuthApi = {
  async register(email, password) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdToken(true);
    localStorage.setItem("token", token);
    return credential.user;
  },

  async login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdToken(true);
    localStorage.setItem("token", token);
    return credential.user;
  },

  async logout() {
    await signOut(auth);
    localStorage.removeItem("token");
  },

  getUser() {
    return auth.currentUser;
  },

  async getToken(forceRefresh = false) {
    if (!auth.currentUser) {
      return localStorage.getItem("token");
    }
    const token = await auth.currentUser.getIdToken(forceRefresh);
    localStorage.setItem("token", token);
    return token;
  }
};