const express = require("express");
const cors = require("cors");
require("dotenv").config();

const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin (SECURE)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔐 LOGIN API
app.post("/api/login", async (req, res) => {
    const { regNo, pass } = req.body;

    try {
        const snap = await db.collection("students")
            .where("regNo", "==", regNo)
            .where("password", "==", pass)
            .get();

        if (snap.empty) {
            return res.json({ success: false });
        }

        const user = snap.docs[0].data();
        user.id = snap.docs[0].id;

        res.json({ success: true, user });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 💰 PAYMENT HISTORY
app.get("/api/payments/:regNo", async (req, res) => {
    const regNo = req.params.regNo;

    try {
        const snap = await db.collection("payments")
            .where("regNo", "==", regNo)
            .get();

        const payments = [];
        snap.forEach(doc => payments.push(doc.data()));

        res.json(payments);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📍 ATTENDANCE
app.post("/api/attendance", async (req, res) => {
    try {
        await db.collection("attendance").add(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Server running"));