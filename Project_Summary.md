# CareHub - Comprehensive Healthcare Management Platform

## 👥 Team Members
**Information Technology Institute (ITI) - MERN Stack Track**
- Dalia Mohammed
- Hassan Sherif
- Mohamed Medhat
- Mohanad Ahmed
- Nermen Moussa
- Taha HodHod

---

## 🚀 Project Overview
**CareHub** is a multi-role healthcare management platform developed as an ITI graduation project. Its ultimate mission is to digitize and streamline the clinical workflow, bridging the gaps between patients, doctors, medical assistants, and system administrators. 

The platform is built on the modern MERN stack, offering a cloud-native, secure, and fully integrated ecosystem to solve traditional clinic management challenges like inefficient scheduling, disconnected health records, and financial friction.

---

## ✨ Key Features & Portals

### 1. 🧑‍⚕️ Patient Portal
- **Appointments:** Seamless appointment booking and scheduling.
- **Digital Wallet:** In-app digital wallet for transactions and checkouts (Kashier Gateway).
- **Health Tracking:** Interactive tracking of vitals, symptoms, and medical history timeline.
- **Records & Prescriptions:** Full access to digital prescriptions (with PDF exports) and medication reminder schedules.

### 2. 👨‍⚕️ Doctor Workspace
- **Live Consultation Queue:** Real-time queue management synced with the assistant's screen via Socket.io.
- **Digital Prescriptions:** Robust digital prescription builder.
- **AI Clinical Assistant (CDSS):** Google Gemini AI integration to analyze prescriptions for drug-to-drug interactions, side effects, and automated medical literature retrieval (RAG).
- **Dashboard & Stats:** Comprehensive stats, workspace management, and payout requests.

### 3. 📝 Assistant Workspace
- **Queue Management:** Real-time physical queue organization and OTP-based patient arrival validation.
- **Vitals & Registration:** Recording patient vitals upon clinic arrival and managing billing processing.

### 4. 🛡️ Admin Dashboard
- **Platform Configurations:** Global analytics and ledger monitoring.
- **Approvals:** Doctor medical license review and approval system.
- **Financials:** Handling doctor payout requests and monitoring platform commission revenue.

---

## 🛠️ Technology Stack (Highlights)
- **Frontend:** Next.js 16 (React 19), Tailwind CSS v4, Progressive Web App (PWA) with Offline Fallbacks (Serwist).
- **Backend:** Node.js, Express.js v5, MongoDB (Mongoose), Redis (caching & sessions).
- **Real-Time:** Socket.io for live queuing and instant push notifications.
- **Security:** Passwordless Biometric Passkeys (WebAuthn), JWT dual-token flow, and Role-Based Access Control (RBAC).
- **AI Integration:** Google Gemini AI with fallback mechanisms and local/Pinecone vector databases for RAG.
