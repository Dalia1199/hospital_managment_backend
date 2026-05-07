import mongoose from "mongoose";
import {  providerenum, roleenum } from "../../common/enum/user.enum.js";

const userschema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true,
        minLength: 3,
        maxLength: 7,
        trim: true
    },
    lastname: {
        type: String,
        required: true,
        minLength: 3,
        maxLength: 7,
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
    phone:{
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
userschema.virtual("username")
    .get(function () {
        return this.firstname + " " + this.lastname
    })
    .set(function (value) {
        const [firstname, lastname] = value.split(" ")
        this.set({ firstname, lastname })
    })
const usermodel = mongoose.models.user || mongoose.model("user", userschema)
export default usermodel