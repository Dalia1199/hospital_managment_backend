import mongoose from "mongoose";

const pushPermissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      required: true,
    },
    subscription: {
      endpoint: { type: String, required: true },
      expirationTime: { type: Number },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
    },
  },
  { timestamps: true }
);

const pushPermissionModel =
  mongoose.models.pushPermission ||
  mongoose.model("pushPermission", pushPermissionSchema);

export default pushPermissionModel;
