/**
 * One-time migration script: backfill platform_ledger entries for all historical
 * subscription payments that were paid BEFORE the automatic ledger-write was added.
 *
 * Run ONCE with:  node --experimental-vm-modules src/scripts/backfill_subscription_ledger.js
 * (or via ts-node / nodemon if you prefer)
 *
 * Safe to re-run — it skips any payment that already has a matching ledger entry.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// ── Load env ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// The project stores env vars in config/.env.development (not root .env)
dotenv.config({ path: path.resolve(__dirname, "../../../config/.env.development") });

// ── Import models (after env is loaded) ───────────────────────────────────────
import paymentmodel        from "../DB/models/paymentmodel.js";
import platformledgermodel from "../DB/models/platform_ledger_model.js";

// ── Connect ───────────────────────────────────────────────────────────────────
await mongoose.connect(process.env.DB_URL_ONLINE);
console.log("✅ Connected to MongoDB");

// ── Run backfill ──────────────────────────────────────────────────────────────
const subscriptionPayments = await paymentmodel.find({
    purpose:       "subscription",
    paymentStatus: "paid"
}).lean();

console.log(`📦 Found ${subscriptionPayments.length} paid subscription payment(s) to process`);

let inserted = 0;
let skipped  = 0;

for (const payment of subscriptionPayments) {
    // Check if a ledger entry already exists for this payment (idempotency)
    const existing = await platformledgermodel.findOne({
        source:      "subscription",
        referenceId: payment._id
    });

    if (existing) {
        skipped++;
        continue;
    }

    await platformledgermodel.create({
        amount:      payment.amount,
        source:      "subscription",
        referenceId: payment._id,
        doctorId:    payment.userId,    // for subscriptions, userId IS the doctorId
        createdAt:   payment.createdAt  // preserve original payment date for accurate filtering
    });

    inserted++;
}

console.log(`\n✅ Done!`);
console.log(`   Inserted : ${inserted}`);
console.log(`   Skipped  : ${skipped} (already existed)`);

await mongoose.disconnect();
process.exit(0);
