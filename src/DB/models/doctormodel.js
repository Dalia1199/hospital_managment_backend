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
   bio: {
    type:String,
     maxlength:200,
      minlength:20,
   },
    consultationFee: {
        type: Number,
        required: false,
        min: 0
    },
    activeVectorDbName: { type: String, default: "Default_DB" },
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