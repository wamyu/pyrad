import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyCBrrKeO4dAWddgaHw4DHUeDfwnTmPRk-w",
	authDomain: "loom-493fa.firebaseapp.com",
	projectId: "loom-493fa",
	storageBucket: "loom-493fa.firebasestorage.app",
	messagingSenderId: "355272733497",
	appId: "1:355272733497:web:cc2b33a144f7589af96ee8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

