import walletmodel from "../../DB/models/walletmodel.js";
import transactionmodel from "../../DB/models/transactionmodel.js";

export const getWallet = async (userId, session = null) => {
    let wallet = await walletmodel.findOne({ userId }).session(session);
    if (!wallet) {
        const wallets = await walletmodel.create([{ userId }], { session });
        wallet = wallets[0];
    }
    return wallet;
};

// Add pending funds to doctor from online booking
export const addPendingBalance = async (userId, amount, referenceId, metadata = {}, session = null) => {
    const wallet = await walletmodel.findOneAndUpdate(
        { userId },
        { $inc: { pendingBalance: amount } },
        { new: true, upsert: true, session }
    );

    await transactionmodel.create([{
        userId,
        amount,
        type: 'credit',
        purpose: 'online_booking_revenue',
        referenceId,
        metadata
    }], { session });
    
    return wallet;
};

// Release pending funds to available (when appointment is completed)
export const releasePendingToAvailable = async (userId, amount, session = null) => {
    // We only release if pendingBalance is sufficient. 
    // This is hard to do purely with $inc if we want to ensure it doesn't go below 0, 
    // but we can query with a condition: { userId, pendingBalance: { $gte: amount } }
    const wallet = await walletmodel.findOneAndUpdate(
        { userId, pendingBalance: { $gte: amount } },
        { $inc: { pendingBalance: -amount, availableBalance: amount } },
        { new: true, session }
    );
    
    if (!wallet) {
        console.warn(`[releasePendingToAvailable] Failed or insufficient pending balance for user ${userId}, amount ${amount}`);
        return await getWallet(userId, session); // return the unchanged wallet
    }
    return wallet;
};

// Cancel and remove pending funds (when appointment is cancelled by doctor)
export const removePendingBalance = async (userId, amount, session = null) => {
    const wallet = await walletmodel.findOneAndUpdate(
        { userId, pendingBalance: { $gte: amount } },
        { $inc: { pendingBalance: -amount } },
        { new: true, session }
    );
    
    if (!wallet) {
        console.warn(`[removePendingBalance] Failed or insufficient pending balance for user ${userId}, amount ${amount}`);
        return await getWallet(userId, session);
    }
    return wallet;
};

// Add available balance (e.g. for patient refund or doctor compensation)
export const addAvailableBalance = async (userId, amount, purpose, referenceId = null, metadata = {}, session = null) => {
    const wallet = await walletmodel.findOneAndUpdate(
        { userId },
        { $inc: { availableBalance: amount } },
        { new: true, upsert: true, session }
    );

    await transactionmodel.create([{
        userId,
        amount,
        type: 'credit',
        purpose,
        referenceId,
        metadata
    }], { session });
    
    return wallet;
};

// Deduct available balance (e.g. withdrawal or paying from wallet)
export const deductAvailableBalance = async (userId, amount, purpose, referenceId = null, session = null) => {
    const wallet = await walletmodel.findOneAndUpdate(
        { userId, availableBalance: { $gte: amount } },
        { $inc: { availableBalance: -amount } },
        { new: true, session }
    );
    
    if (!wallet) {
        throw new Error("Insufficient available balance");
    }

    await transactionmodel.create([{
        userId,
        amount,
        type: 'debit',
        purpose,
        referenceId
    }], { session });
    
    return wallet;
};
