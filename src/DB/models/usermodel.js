import mongoose from "mongoose";
import {  providerenum, roleenum } from "../../common/enum/user.enum.js";

const userschema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        minLength: 6,
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
    phoneNumber:{
        type:String,
        required:true
    },
  
    role: {
        type: String,
        enum: Object.values(roleenum),
        default: roleenum.doctor
    },
    profilepictures: {
        secure_url: { type:String, required: false },
        puplic_id: { type: String, required: false },
    },

    
    changecredential: Date,
  


    confirmed: Boolean,
    address: {type: String, required: false},
    provider: {
        type: String,
        enum: Object.values(providerenum),
        default: providerenum.system
    },

}, {
    timestamps: true, 
    strictQuery: true,
    toJSON: { virtuals: true }
})

const usermodel = mongoose.models.user || mongoose.model("user", userschema)
export default usermodel