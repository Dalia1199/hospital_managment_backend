import payoutrequestmodel from "../../DB/models/payoutrequestmodel.js";
import { getWallet, deductAvailableBalance } from "../wallet/wallet.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

export const requestPayout = async (req, res, next) => {
    try {
        const { amount, paymentMethod, paymentDetails } = req.body;
        const userId = req.user._id;

        const wallet = await getWallet(userId);
        if (wallet.availableBalance < amount) {
            throw new Error("Insufficient available balance", { cause: 400 });
        }

        // Deduct from wallet immediately to prevent double spending
        await deductAvailableBalance(userId, amount, 'payout_withdrawal');

        const payoutReq = await payoutrequestmodel.create({
            userId,
            amount,
            paymentMethod,
            paymentDetails,
            status: 'pending'
        });

        return successresponse({
            res,
            message: "Payout request submitted successfully",
            data: payoutReq
        });
    } catch (error) {
        next(error);
    }
};

export const getMyPayouts = async (req, res, next) => {
    try {
        const payouts = await payoutrequestmodel.find({ userId: req.user._id }).sort({ createdAt: -1 });
        return successresponse({
            res,
            message: "Payouts retrieved successfully",
            data: payouts
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const getAllPayoutRequests = async (req, res, next) => {
    try {
        const payouts = await payoutrequestmodel.find({}).populate('userId', 'fullName email role').sort({ createdAt: -1 });
        return successresponse({
            res,
            message: "All payouts retrieved successfully",
            data: payouts
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const updatePayoutStatus = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const { status, adminNotes } = req.body; // status: 'paid' or 'rejected'

        const payoutReq = await payoutrequestmodel.findById(requestId);
        if (!payoutReq) {
            throw new Error("Payout request not found", { cause: 404 });
        }

        if (payoutReq.status !== 'pending') {
            throw new Error(`Payout request is already ${payoutReq.status}`, { cause: 400 });
        }

        payoutReq.status = status;
        if (adminNotes) payoutReq.adminNotes = adminNotes;
        await payoutReq.save();

        if (status === 'rejected') {
            // Refund the deducted amount back to user's wallet
            const { addAvailableBalance } = await import('../wallet/wallet.service.js');
            await addAvailableBalance(payoutReq.userId, payoutReq.amount, 'refund', payoutReq._id, { notes: "Payout rejected" });
        }

        return successresponse({
            res,
            message: `Payout request marked as ${status}`,
            data: payoutReq
        });
    } catch (error) {
        next(error);
    }
};
