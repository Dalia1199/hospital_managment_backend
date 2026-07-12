<div align="center">
  <h1>🏥 CareHub — Backend API</h1>
  <p><strong>RESTful API powering the CareHub healthcare platform.</strong></p>
  <a href="https://carehub-two.vercel.app">🌐 Live Frontend</a> ·
  <a href="https://github.com/honda4coding/carehub">Frontend Repository</a>
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Authentication — `/users`](#authentication----users)
  - [Patient — `/patient`](#patient----patient)
  - [Doctor — `/doctor`](#doctor----doctor)
  - [Appointments — `/appointments`](#appointments----appointments)
  - [Medical History — `/medical-history`](#medical-history----medical-history)
  - [Prescriptions — `/prescrption`](#prescriptions----prescrption)
  - [Clinics — `/clinics`](#clinics----clinics)
  - [AI Assistant — `/ai`](#ai-assistant----ai)
  - [Drugs — `/drugs`](#drugs----drugs)
  - [Payments — `/payments`](#payments----payments)
  - [Wallet — `/wallet`](#wallet----wallet)
  - [Payout — `/payout`](#payout----payout)
  - [Notifications — `/notifications`](#notifications----notifications)
  - [Reviews — `/reviews`](#reviews----reviews)
  - [Questions — `/questions`](#questions----questions)
  - [Subscriptions — `/subscriptions`](#subscriptions----subscriptions)
  - [Doctor Subscriptions — `/doctorsubscriptions`](#doctor-subscriptions----doctorsubscriptions)
  - [WebAuthn — `/webauthn`](#webauthn----webauthn)
  - [Support — `/support`](#support----support)
  - [Admin — `/admin`](#admin----admin)
  - [Admin Dashboard — `/admindashboard`](#admin-dashboard----admindashboard)
  - [App Config — `/appconfig`](#app-config----appconfig)
- [Database Models](#database-models)
- [Background Jobs](#background-jobs)
- [Real-time Features](#real-time-features)

---

## Overview

CareHub Backend is a Node.js / Express.js REST API that powers the CareHub patient portal. It handles authentication, medical records, appointment scheduling, live consultation queue management, AI-powered clinical tools, digital wallets, subscription plans, and more.

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js (ESM modules) |
| Framework | Express.js v5 |
| Database | MongoDB + Mongoose |
| Cache | Redis |
| Real-time | Socket.io |
| File Uploads | Multer + Cloudinary |
| Email | Nodemailer |
| Authentication | JWT (jsonwebtoken) + bcrypt |
| Validation | Joi |
| AI | Google Generative AI (Gemini) + Pinecone (Vector DB) |
| Passkey | SimpleWebAuthn Server |
| Push Notifications | Web Push (VAPID) |
| Scheduling | node-cron |
| PDF Parsing | pdf-parse |
| Payments | Custom checkout + Webhook integration |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance
- Redis instance

### Installation

```bash
# Clone the repository
git clone https://github.com/Dalia1199/hospital_managment_backend.git
cd hospital_managment_backend

# Install dependencies
npm install

# Start the development server (port 3000)
npm run dev
```

### Scripts

```bash
npm run dev        # Development mode with nodemon (hot reload)
npm run start      # Production mode
npm run backfill:subscriptions  # Backfill subscription ledger data
```

---

## Environment Variables

Create a `config/.env.development` file (and `.env.production` for prod):

```env
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/carehub
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
NODEMAILER_EMAIL=your_email@gmail.com
NODEMAILER_PASS=your_app_password

# AI
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key

# Web Push (VAPID)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your_email@gmail.com
```

---

## API Reference

> **Auth header**: All protected routes require `Authorization: Bearer <token>`
> 
> **Roles**: `patient` | `doctor` | `assistant` | `admin`

---

### Authentication — `/users`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/users/signup` | ❌ | any | Register new user (patient or doctor) |
| POST | `/users/signin` | ❌ | any | Login and receive JWT token |
| POST | `/users/logout` | ✅ | any | Logout (invalidate session) |
| GET | `/users/profile` | ✅ | any | Get current user's profile |
| DELETE | `/users/profile` | ✅ | any | Delete current user's account |
| PATCH | `/users/update-password` | ✅ | any | Change password |
| PATCH | `/users/forget-password` | ❌ | any | Request OTP for password reset |
| PATCH | `/users/reset-password` | ❌ | any | Reset password using OTP |
| PATCH | `/users/confirm-email` | ❌ | any | Confirm email via OTP |
| POST | `/users/resend-otp` | ❌ | any | Resend OTP email |
| GET | `/users/refresh-token` | ❌ | any | Refresh JWT access token |

---

### Patient — `/patient`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/patient/profile` | ✅ | patient | Get patient profile |
| PATCH | `/patient/profile` | ✅ | patient | Update patient profile info |
| PATCH | `/patient/profile-image` | ✅ | patient | Upload profile picture |
| DELETE | `/patient/profile-image` | ✅ | patient | Delete profile picture |
| GET | `/patient/prescriptions` | ✅ | patient | Get all my prescriptions |
| GET | `/patient/prescriptions/:prescriptionId` | ✅ | patient | Get a single prescription |
| POST | `/patient/tracking` | ✅ | patient | Add a health tracking record |
| GET | `/patient/tracking` | ✅ | patient | Get all health tracking records |
| GET | `/patient/medications/active` | ✅ | patient | Get active medications |
| GET | `/patient/medications/history` | ✅ | patient | Get medication history |
| POST | `/patient/medications/track` | ✅ | patient | Log a medication dose taken |
| GET | `/patient/medications/summary` | ✅ | patient | Get medication adherence summary |
| POST | `/patient/medication-schedule` | ✅ | patient | Set medication reminder schedule |
| GET | `/patient/medication-schedule` | ✅ | patient | Get medication schedules |

---

### Doctor — `/doctor`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/doctor/global` | ❌ | any | List all approved doctors (public) |
| GET | `/doctor/all` | ✅ | patient/doctor/admin | List all approved doctors |
| GET | `/doctor/dashboard` | ✅ | doctor | Get doctor dashboard stats |
| GET | `/doctor/profile` | ✅ | doctor | Get doctor profile |
| PATCH | `/doctor/profile` | ✅ | doctor | Update doctor profile |
| PATCH | `/doctor/profile-image` | ✅ | doctor | Upload doctor profile picture |
| DELETE | `/doctor/profile-image` | ✅ | doctor | Delete doctor profile picture |
| PATCH | `/doctor/license` | ✅ | doctor | Upload / update medical license |
| DELETE | `/doctor/license/pending` | ✅ | doctor | Cancel pending license review |
| GET | `/doctor/profile/certificates` | ✅ | doctor | Get all certificates |
| POST | `/doctor/profile/certificates` | ✅ | doctor | Add a new certificate |
| PATCH | `/doctor/profile/certificates/:certificateId` | ✅ | doctor | Update a certificate |
| DELETE | `/doctor/profile/certificates/:certificateId` | ✅ | doctor | Delete a certificate |
| GET | `/doctor/search-patient` | ✅ | doctor | Search patients by name/phone |
| POST | `/doctor/session/request` | ✅ | doctor | Create consultation session (sends OTP) |
| POST | `/doctor/session/verify` | ✅ | doctor | Verify patient OTP to start session |
| GET | `/doctor/session` | ✅ | doctor | Get active sessions (queue) |
| PATCH | `/doctor/session/reorder` | ✅ | doctor | Reorder session queue |
| PATCH | `/doctor/session/:sessionId/vitals` | ✅ | doctor | Update session vitals |
| PATCH | `/doctor/session/:sessionId/fees` | ✅ | doctor | Update session fees |
| PATCH | `/doctor/session/:sessionId/end` | ✅ | doctor | End session + save medical history |
| DELETE | `/doctor/session/:sessionId/cancel` | ✅ | doctor | Cancel a session |
| GET | `/doctor/my-patients` | ✅ | doctor | Get list of doctor's patients |
| GET | `/doctor/my-prescriptions` | ✅ | doctor | Get all prescriptions written by doctor |
| GET | `/doctor/patient/history` | ✅ | doctor | Get full medical history for a patient |
| PATCH | `/doctor/patient/:patientId/alerts` | ✅ | doctor | Update patient chronic/allergy alerts |
| GET | `/doctor/patient/:patientId/compliance` | ✅ | doctor | Get patient medication compliance |
| GET | `/doctor/medications/history` | ✅ | doctor | Get medication history for patients |
| GET | `/doctor/reports/analytics` | ✅ | doctor | Get reports & analytics data |
| GET | `/doctor/notifications` | ✅ | doctor | Get all notifications |
| POST | `/doctor/staff` | ✅ | doctor | Create assistant staff account |
| GET | `/doctor/staff` | ✅ | doctor | List all staff members |
| PUT | `/doctor/staff/:id` | ✅ | doctor | Update staff member info/permissions |
| DELETE | `/doctor/staff/:id` | ✅ | doctor | Delete staff member |
| GET | `/doctor/staff/logs` | ✅ | doctor | Get staff action audit logs |

---

### Appointments — `/appointments`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/appointments/availability` | ✅ | doctor | Get doctor's availability schedule |
| POST | `/appointments/availability` | ✅ | doctor | Add availability block |
| PATCH | `/appointments/availability/:availabilityId` | ✅ | doctor | Update availability block |
| DELETE | `/appointments/availability/:availabilityId` | ✅ | doctor | Delete availability block |
| POST | `/appointments/generate-slots` | ✅ | doctor | Generate appointment slots from availability |
| GET | `/appointments/available-slots/me` | ✅ | doctor | Get my own available slots |
| GET | `/appointments/available-slots/:doctorId` | ✅ | patient/doctor | Get a doctor's available slots |
| POST | `/appointments/hold` | ✅ | patient | Hold a slot for 5 minutes (pre-payment) |
| POST | `/appointments/book` | ✅ | patient | Book an appointment directly |
| POST | `/appointments/confirm` | ✅ | patient | Confirm appointment after payment |
| POST | `/appointments/release-reservation` | ✅ | patient | Release a held slot |
| GET | `/appointments/my-appointments` | ✅ | patient | Get patient's appointments |
| GET | `/appointments/patient` | ✅ | patient | Get patient appointments (alternative) |
| PATCH | `/appointments/cancel/:appointmentId` | ✅ | patient | Cancel appointment |
| PATCH | `/appointments/reschedule/:appointmentId` | ✅ | patient | Reschedule appointment |
| GET | `/appointments/doctor-appointments` | ✅ | doctor | Get doctor's appointments |
| GET | `/appointments/dashboard` | ✅ | doctor | Doctor appointment dashboard |
| GET | `/appointments/doctor/today` | ✅ | doctor | Get today's appointments |
| GET | `/appointments/doctor/upcoming` | ✅ | doctor | Get upcoming appointments |
| GET | `/appointments/doctor/completed` | ✅ | doctor | Get completed appointments |
| PATCH | `/appointments/complete/:appointmentId` | ✅ | doctor | Mark appointment as completed |
| DELETE | `/appointments/slot/:slotId` | ✅ | doctor | Delete a slot |
| PATCH | `/appointments/slot/:slotId` | ✅ | doctor | Update a slot |
| DELETE | `/appointments/slots/:slotId` | ✅ | doctor | Delete a doctor slot |
| POST | `/appointments/slots/delete-multiple` | ✅ | doctor | Delete multiple slots at once |
| POST | `/appointments/:appointmentId/schedule-followup` | ✅ | doctor | Schedule a follow-up appointment |
| PATCH | `/appointments/:appointmentId/override-followup` | ✅ | doctor | Override follow-up appointment |

---

### Medical History — `/medical-history`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/medical-history/` | ✅ | doctor | Create a medical history record |
| GET | `/medical-history/:patientId` | ✅ | doctor/patient | Get medical history for a patient |
| PATCH | `/medical-history/upload/:historyId` | ✅ | doctor/patient | Upload document to a history record |
| DELETE | `/medical-history/document/:historyId` | ✅ | doctor/patient | Delete a document from history |

---

### Prescriptions — `/prescrption`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/prescrption/create` | ✅ | doctor | Create a new prescription |
| PATCH | `/prescrption/:id` | ✅ | doctor | Update prescription text/medications |
| PATCH | `/prescrption/:id/upload` | ✅ | doctor | Upload scanned prescription image |
| GET | `/prescrption/patient/:patientId` | ✅ | doctor/patient | Get prescriptions for a patient |
| DELETE | `/prescrption/:id` | ✅ | doctor/admin | Delete a prescription |

---

### Clinics — `/clinics`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/clinics/` | ✅ | doctor | Get my clinics |
| POST | `/clinics/` | ✅ | doctor | Add a new clinic |
| PATCH | `/clinics/:clinicId` | ✅ | doctor | Update clinic information |
| DELETE | `/clinics/:clinicId` | ✅ | doctor | Delete a clinic |
| GET | `/clinics/doctor/:doctorId` | ✅ | patient/doctor | Get a specific doctor's clinics |
| POST | `/clinics/:clinicId/services` | ✅ | doctor | Add a service to a clinic |
| PATCH | `/clinics/:clinicId/services/:serviceId` | ✅ | doctor | Update a clinic service |
| DELETE | `/clinics/:clinicId/services/:serviceId` | ✅ | doctor | Delete a clinic service |

---

### AI Assistant — `/ai`

> Requires `ai` feature enabled in doctor subscription plan.

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/ai/upload` | ✅ | doctor | Upload a PDF to knowledge base |
| POST | `/ai/upload/bulk` | ✅ | doctor | Bulk upload PDFs (up to 100 files) |
| GET | `/ai/knowledge-base` | ✅ | doctor | List knowledge base documents |
| POST | `/ai/knowledge-base/databases` | ✅ | doctor | Create a new vector database |
| PUT | `/ai/knowledge-base/databases/active` | ✅ | doctor | Set active vector database |
| DELETE | `/ai/knowledge-base/clear` | ✅ | doctor | Clear all documents from knowledge base |
| DELETE | `/ai/knowledge-base/:fileName` | ✅ | doctor | Delete a specific document |
| POST | `/ai/ask` | ✅ | doctor | Ask clinical assistant a question |
| GET | `/ai/patient/:patientId/insights` | ✅ | doctor | Get AI-generated insights for a patient |
| POST | `/ai/interactions` | ✅ | doctor | Check drug interactions |
| POST | `/ai/differential-diagnosis` | ✅ | doctor | Get differential diagnosis suggestions |
| POST | `/ai/chatbot` | ✅ | patient | Patient AI chatbot (health Q&A) |

---

### Drugs — `/drugs`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/drugs/search` | ✅ | doctor | Search drug database |
| POST | `/drugs/seed` | ❌ | any | Seed drug data (admin tool) |

---

### Payments — `/payments`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/payments/checkout` | ✅ | doctor/patient | Create payment checkout session |
| POST | `/payments/checkout-wallet` | ✅ | patient | Pay appointment fee from wallet |
| GET | `/payments/callback` | ❌ | — | Payment gateway callback |
| POST | `/payments/webhook` | ❌ | — | Payment gateway webhook |

---

### Wallet — `/wallet`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/wallet/my-wallet` | ✅ | any | Get my wallet balance |
| GET | `/wallet/my-transactions` | ✅ | any | Get my transaction ledger |
| GET | `/wallet/admin/stats` | ✅ | admin | Get platform-wide wallet stats |
| GET | `/wallet/admin/user-wallet/:userId` | ✅ | admin | Get a specific user's wallet |
| POST | `/wallet/admin/adjust` | ✅ | admin | Manually adjust a user's wallet balance |

---

### Payout — `/payout`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/payout/profile` | ✅ | any | Get my payout profile |
| POST | `/payout/profile/setup` | ✅ | any | Setup payout profile (first time) |
| POST | `/payout/request-change` | ✅ | doctor/patient | Request payout profile change |
| GET | `/payout/my-methods` | ✅ | doctor/patient | Get approved payout methods |
| POST | `/payout/request` | ✅ | any | Submit a payout request |
| GET | `/payout/my-requests` | ✅ | any | Get my payout requests |
| GET | `/payout/all` | ✅ | admin | Get all payout requests |
| PATCH | `/payout/:requestId/status` | ✅ | admin | Update payout request status |
| GET | `/payout/admin/change-requests` | ✅ | admin | Get all profile change requests |
| PATCH | `/payout/admin/change-requests/:requestId/status` | ✅ | admin | Approve/reject profile change request |
| PATCH | `/payout/admin/suspend-wallet` | ✅ | admin | Suspend a user's payout profile |

---

### Notifications — `/notifications`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/notifications/` | ✅ | all roles | Get all notifications |
| PATCH | `/notifications/read-all` | ✅ | all roles | Mark all notifications as read |
| PATCH | `/notifications/:id/read` | ✅ | all roles | Mark a single notification as read |
| POST | `/notifications/push-permission` | ✅ | all roles | Save device push notification token |
| DELETE | `/notifications/push-permission` | ✅ | all roles | Remove push notification token |

---

### Reviews — `/reviews`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/reviews/:doctorId` | ✅ | patient | Add a review for a doctor |
| GET | `/reviews/:doctorId` | ✅ | any | Get all reviews for a doctor |
| DELETE | `/reviews/:reviewId` | ✅ | patient | Delete own review |

---

### Questions — `/questions`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/questions/` | ❌ | any | Get medical intake questionnaire |

---

### Subscriptions — `/subscriptions`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/subscriptions/` | ✅ | doctor/admin | List all subscription plans |
| GET | `/subscriptions/:planId` | ✅ | doctor/admin | Get a specific plan |
| POST | `/subscriptions/create` | ✅ | admin | Create a new subscription plan |
| PATCH | `/subscriptions/:planId` | ✅ | admin | Update a subscription plan |
| DELETE | `/subscriptions/:planId` | ✅ | admin | Delete a subscription plan |

---

### Doctor Subscriptions — `/doctorsubscriptions`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/doctorsubscriptions/my-subscription` | ✅ | doctor | Get my current subscription |
| GET | `/doctorsubscriptions/` | ✅ | admin | Get all doctor subscriptions |
| GET | `/doctorsubscriptions/doctor/:doctorId` | ✅ | admin | Get a specific doctor's subscription |
| GET | `/doctorsubscriptions/:subscriptionId` | ✅ | admin | Get subscription by ID |
| PATCH | `/doctorsubscriptions/:subscriptionId/cancel` | ✅ | doctor/admin | Cancel subscription |
| POST | `/doctorsubscriptions/:subscriptionId/renew` | ✅ | doctor | Renew subscription |

---

### WebAuthn — `/webauthn`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/webauthn/register/options` | ✅ | any | Get passkey registration options |
| POST | `/webauthn/register/verify` | ✅ | any | Verify and save passkey registration |
| GET | `/webauthn/status` | ✅ | any | Check biometric/passkey status |
| DELETE | `/webauthn/remove` | ✅ | any | Remove registered passkey |
| POST | `/webauthn/login/options` | ❌ | any | Get passkey login options |
| POST | `/webauthn/login/verify` | ❌ | any | Verify passkey login |

---

### Support — `/support`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/support/` | ✅ | any | Submit a support message |
| GET | `/support/` | ✅ | admin | Get all support messages (paginated) |
| GET | `/support/unread-count` | ✅ | admin | Get unread messages count |
| PATCH | `/support/:messageId/read` | ✅ | admin | Toggle message read status |

---

### Admin — `/admin`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/admin/dashboard` | ✅ | admin | Get admin dashboard stats |
| GET | `/admin/profile` | ✅ | admin | Get admin profile |
| PATCH | `/admin/profile` | ✅ | admin | Update admin profile |
| PATCH | `/admin/profile-image` | ✅ | admin | Upload admin profile picture |
| DELETE | `/admin/profile-image` | ✅ | admin | Delete admin profile picture |
| GET | `/admin/users` | ✅ | admin | Get all users (paginated) |
| PATCH | `/admin/:id/activate` | ✅ | admin | Activate a user account |
| PATCH | `/admin/:id/deactivate` | ✅ | admin | Deactivate a user account |
| GET | `/admin/doctors` | ✅ | admin | Get all doctors |
| GET | `/admin/doctors/pending` | ✅ | admin | Get doctors pending approval |
| PATCH | `/admin/doctors/:id/approve` | ✅ | admin | Approve a doctor |
| PATCH | `/admin/doctors/:id/reject` | ✅ | admin | Reject a doctor |
| PATCH | `/admin/doctors/:id/pending` | ✅ | admin | Reset doctor status to pending |
| GET | `/admin/doctors/pending-licenses` | ✅ | admin | Get doctors with pending license updates |
| PATCH | `/admin/doctors/:id/approve-license` | ✅ | admin | Approve a doctor's license update |
| PATCH | `/admin/doctors/:id/reject-license` | ✅ | admin | Reject a doctor's license update |
| GET | `/admin/doctors/appointments-ranking` | ✅ | admin | Get top doctors by appointment count |
| GET | `/admin/stats/monthly` | ✅ | admin | Get monthly platform statistics |
| GET | `/admin/stats/daily` | ✅ | admin | Get daily statistics |
| GET | `/admin/stats/payments` | ✅ | admin | Get payment analytics |
| GET | `/admin/stats/analytics` | ✅ | admin | Get overall analytics stats |

---

### Admin Dashboard — `/admindashboard`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/admindashboard/` | ✅ | admin | Get main admin dashboard data |
| GET | `/admindashboard/financial-stats` | ✅ | admin | Get financial statistics |
| GET | `/admindashboard/revenue-chart` | ✅ | admin | Get revenue chart data |
| GET | `/admindashboard/payments` | ✅ | admin | Get payments report |
| GET | `/admindashboard/method` | ✅ | admin | Get payment methods chart data |
| GET | `/admindashboard/staticis` | ✅ | admin | Get subscription statistics |
| GET | `/admindashboard/expired` | ✅ | admin | Get expiring subscriptions |
| GET | `/admindashboard/growth` | ✅ | admin | Get revenue growth data |
| GET | `/admindashboard/recent` | ✅ | admin | Get recent subscriptions |
| GET | `/admindashboard/top` | ✅ | admin | Get top subscription plans |

---

### App Config — `/appconfig`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/appconfig/` | ✅ | admin | Get global platform configuration |
| PATCH | `/appconfig/` | ✅ | admin | Update global platform configuration (fees, commissions, refund percentages) |

---

## Database Models

| Model | Collection | Description |
|---|---|---|
| `User` | users | Base user account (email, password, role, OTP) |
| `Patient` | patients | Patient profile (DOB, blood type, allergies, chronic diseases, vitals) |
| `Doctor` | doctors | Doctor profile (specialization, license, certificates, consultation fee, AI knowledge base) |
| `Assistant` | assistants | Medical assistant profile linked to a doctor |
| `MedicalHistory` | medicalhistories | Full encounter record (diagnosis, vitals, prescriptions, documents, answers) |
| `Prescription` | prescrptions | Digital prescription (medications list, notes, scanned image) |
| `Appointment` | appointments | Appointment between patient and doctor |
| `Session` | sessions | Live consultation session (OTP-verified) |
| `Clinic` | clinics | Doctor clinic info (address, governorate, services) |
| `Availability` | availabilities | Doctor's available time blocks |
| `Slot` | slots | Individual appointment slots generated from availability |
| `Question` | questions | Medical intake questionnaire questions |
| `Answer` | answers | Patient answers to intake questions |
| `Notification` | notifications | In-app notifications |
| `PushPermission` | pushpermissions | Web push notification tokens |
| `Wallet` | wallets | User wallet balance |
| `Transaction` | transactions | Wallet transaction ledger |
| `PayoutRequest` | payoutrequests | Doctor/patient payout requests |
| `PayoutMethod` | payoutmethods | Approved payout methods (bank/instapay) |
| `PayoutChangeRequest` | payoutchangerequests | Requests to change payout profile |
| `Payment` | payments | Payment records |
| `PaymentAudit` | paymentaudits | Payment audit trail |
| `PlatformLedger` | platformledgers | Platform revenue ledger |
| `SubscriptionPlan` | subscriptionplans | Available subscription tiers |
| `DoctorSubscription` | doctorsubscriptions | Active doctor subscription records |
| `Review` | reviews | Patient reviews for doctors |
| `Drug` | drugs | Drug/medication database |
| `SupportMessage` | supportmessages | User support tickets |
| `Passkey` | passkeys | WebAuthn passkey credentials |
| `HealthTracking` | healthtrackings | Patient health metric entries |
| `MedicationSchedule` | medicationschedules | Medication reminder schedules |
| `MedicationTracking` | medicationtrackings | Medication dose tracking logs |
| `AppConfig` | appconfigs | Global platform configuration |
| `ActionLog` | actionlogs | Staff action audit log |

---

## Background Jobs

| Job | Schedule | Description |
|---|---|---|
| `medicationCron` | Every minute | Send push notifications for due medication reminders |
| `subscriptionCron` | Daily | Expire/renew doctor subscriptions and send notifications |

---

## Real-time Features

Socket.io is used for real-time events:

- **Instant notifications** pushed to connected users
- **Queue updates** when sessions are created, verified, or ended

---

## License

This project is private and not open for public distribution.
