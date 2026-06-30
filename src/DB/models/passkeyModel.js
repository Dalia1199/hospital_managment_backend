import mongoose from "mongoose";

const passkeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      required: true,
    },
    credentialID: {
      type: String,
      required: true,
      unique: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
    deviceType: {
      type: String,
      enum: ["singleDevice", "multiDevice"],
      required: true,
    },
    backedUp: {
      type: Boolean,
      default: false,
    },
    transports: [String],
  },
  { timestamps: true }
);

const passkeyModel =
  mongoose.models.passkey || mongoose.model("passkey", passkeySchema);

export default passkeyModel;
