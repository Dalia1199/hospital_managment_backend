import mongoose from "mongoose";
import { providerenum, roleenum } from "../../common/enum/user.enum.js";

const userschema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        minLength: 3,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,

    },
    password: {
        type: String,
        required: function () {
            return this.provider == providerenum.google ? false : true
        },
        trim: true,
        minLength: 6
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },

    role: {
        type: String,
        enum: Object.values(roleenum),
        default: roleenum.doctor
    },
    profilepicture: {
        secure_url: {
            type: String
        },

        public_id: {
            type: String
        }
    },


    changecredential: Date,



    confirmed: Boolean,
    address: { type: String, required: false },
    provider: {
        type: String,
        enum: Object.values(providerenum),
        default: providerenum.system
    },
    //admin 
    status: {
        type: String,
        enum: ["pending", "active" , "approved" , "rejected", "blocked"],
        default: function () {

            if (this.role === roleenum.doctor) {
                return "pending"
            }

            return "active"
        }
    },

    rejectedReason: {
        type: String
    },
}, {
    timestamps: true,
    strictQuery: true,
    toJSON: { virtuals: true }
})

const usermodel = mongoose.models.user || mongoose.model("user", userschema)
export default usermodel