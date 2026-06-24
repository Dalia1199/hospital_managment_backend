import mongoose from "mongoose";

export const egyptianGovernorates = [
    "Cairo", "Giza", "Alexandria", "Dakahlia", "Red Sea", "Beheira",
    "Fayoum", "Gharbia", "Ismailia", "Menofia", "Minya", "Qaliubiya",
    "New Valley", "North Sinai", "Port Said", "Qalyubia", "Qena",
    "Sharqia", "South Sinai", "Suez", "Aswan", "Asyut", "Beni Suef",
    "Damietta", "Kafr El Sheikh", "Matruh", "Luxor", "Sohag"
];
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);
const clinicSchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        governorate: {
            type: String,
            enum: egyptianGovernorates,
            required: true
        },
        whatsapp: { type: String, trim: true },
        landline: { type: String, trim: true },
        services: { type: [serviceSchema], default: [] },
               
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

const clinicmodel = mongoose.models.clinic || mongoose.model("clinic", clinicSchema);
export default clinicmodel;