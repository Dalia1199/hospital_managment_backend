import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    syncdicatedId: Number,

    licenseimage: {
        secure_url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        }
    },
    pendingLicenseImage: {
        secure_url: String,
        public_id: String
    },
    previousLicenseImage: {
        secure_url: String,
        public_id: String
    },

    specialization: String,
    nationalId: {
        secure_url: String,
        public_id: String
    },
    experience: Number,

    // add bio to the doctor model
    bio: {
        type: String,
        maxlength: 200,
        minlength: 20,
    },
    tagline: { type: String, maxlength: 100, default: null },
    languages: { type: [String], default: [] },
    socialLinks: {
        facebook: { type: String, default: null },
        instagram: { type: String, default: null },
        linkedin: { type: String, default: null },
    },
    patientsTreated: { type: Number, min: 0, default: null },
    university: { type: String, maxlength: 100, default: null },
    graduationYear: { type: Number, min: 1960, max: 2040, default: null },

    vectorDbPath: String,

    //CERTIFICATIONS
    certificates: [
        {
            title: {
                type: String,
                required: true
            },
            
            issuer: {
                type: String,
                required: true
            },

            issueDate: Date,
            
            secure_url: {
                type: String,
                required: true
            },
            public_id: {
                type: String,
                required: true
            }
        }
    ],

    activeVectorDbName: { type: String, default: "Default_DB" },
    consultationFee: {
        type: Number,
        required: false,
        min: 0
    },
    followUpFee: {
        type: Number,
        required: false,
        min: 0,
        default: null
    },
    vectorDatabases: { type: [String], default: ["Default_DB"] },
    knowledgeBaseFiles: [{
        fileName: String,
        dbName: String,
        uploadedAt: { type: Date, default: Date.now }
    }],
}, { timestamps: true });
//CLINIC APPOINTMENT AND ADRESS
//PROFILE PIC

//appointments:{}

const doctormodel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema)
export default doctormodel