# CareHub - Hospital Management Backend 🏥

This is the backend for the CareHub Hospital Management System. It is built using Node.js, Express.js, MongoDB, and Mongoose.

## 🚀 Tech Stack
- **Node.js & Express.js**
- **MongoDB & Mongoose**
- **JWT Authentication**
- **Nodemailer** (for OTP & Emails)
- **Cloudinary** (for file/license uploads)

---

## 📡 Comprehensive API Endpoints Reference

Here is a complete cheat sheet for all the Endpoints across the entire project!

### 🔐 Authentication & Users Module (`/users` أو `/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/users/signin` | Login and get JWT token |
| `POST` | `/users/signup` | Register a new user |
| `POST` | `/users/logout` | Logout user |
| `GET`  | `/users/refresh-token` | Get a new access token |
| `PATCH`| `/users/update-password` | Change password while logged in |
| `PATCH`| `/users/forget-password` | Request password reset OTP |
| `POST` | `/users/reset-password` | Reset password using OTP |
| `PATCH`| `/users/confirm-email` | Confirm account via email OTP |
| `POST` | `/users/resend-otp` | Resend verification OTP |

### 🩺 Doctor Module (`/doctor`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/doctor/dashboard` | Get stats (total patients, etc) |
| `PATCH` | `/doctor/profile` | Update profile info |
| `PATCH` | `/doctor/license` | Upload doctor license |
| `GET` | `/doctor/search-patient` | Search online patients (`?searchTerm=`) |
| `POST` | `/doctor/session/request`| Request OTP & start session |
| `POST` | `/doctor/session/verify` | Verify OTP to open file |
| `GET` | `/doctor/session` | Get active/pending sessions queue |
| `PATCH` | `/doctor/session/:sessionId/end`| End & save session after checkout |
| `DELETE`| `/doctor/session/:sessionId/cancel`| Cancel a pending session |
| `GET` | `/doctor/medications/history` | Get patient's medication history |
| `GET` | `/doctor/patient/history` | Get full medical history for encounter |

### 👨‍⚕️ Patient Module (`/patient`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patient/...` | Fetch patient profile & dashboard |
| `PATCH`| `/patient/...` | Update patient profile & settings |
| `DELETE`| `/patient/...` | Delete patient account or specific data |

### 📋 Medical History Module (`/medicalhistory`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/medicalhistory/` | Create medical record (Supports Offline) |
| `GET` | `/medicalhistory/:patientId` | Get patient's record |
| `PATCH`| `/medicalhistory/upload/:historyId`| Upload attachments |
| `DELETE`| `/medicalhistory/document/:historyId`| Delete an attachment |

### 💊 Prescription Module (`/prescription`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/prescription/...` | Create a new prescription |
| `GET` | `/prescription/...` | Fetch prescriptions for a patient |
| `PATCH`| `/prescription/...` | Update a prescription |
| `DELETE`| `/prescription/...` | Delete a prescription |

### 👑 Admin Module (`/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/...` | Fetch users, doctors, system stats |
| `PATCH`| `/admin/...` | Approve doctors, manage roles |

### ❓ Medical Questions & Answers
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/questions/...` | Fetch pre-examination questions |
| `POST` | `/answers/...` | Submit patient answers |
| `GET` | `/answers/...` | View patient answers |

---
