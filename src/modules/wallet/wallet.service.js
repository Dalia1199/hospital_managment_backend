import walletmodel from "../../DB/models/walletmodel.js";
import transactionmodel from "../../DB/models/transactionmodel.js";

export const getWallet = async (userId) => {
    let wallet = await walletmodel.findOne({ userId });
    if (!wallet) {
        wallet = await walletmodel.create({ userId });
    }
    return wallet;
};

// Add pending funds to doctor from online booking
export const addPendingBalance = async (userId, amount, referenceId, metadata = {}) => {
    const wallet = await getWallet(userId);
    wallet.pendingBalance += amount;
    await wallet.save();

    await transactionmodel.create({
        userId,
        amount,
        type: 'credit',
        purpose: 'online_booking_revenue',
        referenceId,
        metadata
    });
    return wallet;
};

// Release pending funds to available (when appointment is completed)
export const releasePendingToAvailable = async (userId, amount) => {
    const wallet = await getWallet(userId);
    if (wallet.pendingBalance >= amount) {
        wallet.pendingBalance -= amount;
        wallet.availableBalance += amount;
        await wallet.save();
    }
    return wallet;
};

// Cancel and remove pending funds (when appointment is cancelled by doctor)
export const removePendingBalance = async (userId, amount) => {
    const wallet = await getWallet(userId);
    if (wallet.pendingBalance >= amount) {
        wallet.pendingBalance -= amount;
        await wallet.save();
    }
    return wallet;
};

// Add available balance (e.g. for patient refund or doctor compensation)
export const addAvailableBalance = async (userId, amount, purpose, referenceId = null, metadata = {}) => {
    const wallet = await getWallet(userId);
    wallet.availableBalance += amount;
    await wallet.save();

    await transactionmodel.create({
        userId,
        amount,
        type: 'credit',
        purpose,
        referenceId,
        metadata
    });
    return wallet;
};

// Deduct available balance (e.g. withdrawal or paying from wallet)
export const deductAvailableBalance = async (userId, amount, purpose, referenceId = null) => {
    const wallet = await getWallet(userId);
    if (wallet.availableBalance < amount) {
        throw new Error("Insufficient wallet balance");
    }
    wallet.availableBalance -= amount;
    await wallet.save();

    await transactionmodel.create({
        userId,
        amount,
        type: 'debit',
        purpose,
        referenceId
    });
    return wallet;
};
