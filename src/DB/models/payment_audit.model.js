import mongoose from "mongoose";

const paymentAuditSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "appointments" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["success", "failed"], required: true },
  gatewayResponse: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.PaymentAudit || mongoose.model("PaymentAudit", paymentAuditSchema);
