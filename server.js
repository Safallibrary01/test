const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*' })); // For production, replace '*' with your actual frontend URL
app.use(express.json());

// Initialize Firebase Admin SDK Securely
// On Render, you will store your Service Account JSON as an environment variable
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("FATAL ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ==========================================
// 1. LOGIN ENDPOINT
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { regNo, password } = req.body;

        if (!regNo || !password) {
            return res.status(400).json({ error: "Registration number and password are required" });
        }

        const studentsRef = db.collection('students');
        const snapshot = await studentsRef
            .where('regNo', '==', regNo)
            .where('password', '==', password)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const studentDoc = snapshot.docs[0];
        const studentData = studentDoc.data();
        
        // Return data to frontend, omitting the password for security
        delete studentData.password; 
        
        res.status(200).json({ id: studentDoc.id, ...studentData });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================================
// 2. PAYMENT HISTORY ENDPOINT
// ==========================================
app.get('/api/payments/:regNo', async (req, res) => {
    try {
        const { regNo } = req.params;
        
        const paymentsRef = db.collection('payments');
        const snapshot = await paymentsRef.where('regNo', '==', regNo).get();

        const payments = [];
        snapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json(payments);
    } catch (error) {
        console.error("Payments Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================================
// 3. DESK SEAT ATTENDANCE ENDPOINT
// ==========================================
app.post('/api/attendance/seat', async (req, res) => {
    try {
        const { studentId, regNo, name, seatNo } = req.body;

        if (!studentId || !seatNo) {
            return res.status(400).json({ error: "Missing required data" });
        }

        const batch = db.batch();

        // Add attendance record
        const attendanceRef = db.collection('attendance').doc();
        batch.set(attendanceRef, {
            studentId,
            name,
            regNo,
            seatNo,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'Desk Scan'
        });

        // Update student's current seat
        const studentRef = db.collection('students').doc(studentId);
        batch.update(studentRef, { seatNo: seatNo });

        await batch.commit();

        res.status(200).json({ message: "Seat attendance marked successfully" });
    } catch (error) {
        console.error("Seat Attendance Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================================
// 4. ENTRY DOOR ATTENDANCE ENDPOINT
// ==========================================
app.post('/api/attendance/entry', async (req, res) => {
    try {
        const { studentId, regNo, name } = req.body;

        if (!studentId) {
            return res.status(400).json({ error: "Missing required data" });
        }

        await db.collection('attendance').add({
            studentId,
            name,
            regNo,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'Entry Scan'
        });

        res.status(200).json({ message: "Entry attendance marked successfully" });
    } catch (error) {
        console.error("Entry Attendance Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});