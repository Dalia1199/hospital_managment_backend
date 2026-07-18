import { getWallet } from "./wallet.service.js";
import transactionmodel from "../../DB/models/transactionmodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";

export const getMyWallet = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const wallet = await getWallet(userId);
        
        // Compute Gross Revenue and Fees Paid
        const statsAgg = await transactionmodel.aggregate([
            { $match: { userId, purpose: 'online_booking_revenue', status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    grossRevenue: { $sum: { $ifNull: ["$metadata.totalPaid", { $add: ["$amount", { $ifNull: ["$metadata.platformFee", 0] }] }] } },
                    feesPaid: { $sum: { $ifNull: ["$metadata.platformFee", 0] } }
                }
            }
        ]);
        
        const stats = statsAgg[0] || { grossRevenue: 0, feesPaid: 0 };
        const netBalance = wallet.availableBalance + wallet.pendingBalance;

        // Fetch current plan and commission rate
        let myCurrentPlanName = 'free';
        let myCurrentCommissionRate = 10;
        
        const doctorSubscriptionModel = (await import('../../DB/models/doctor.subscription.js')).default;
        const subscriptionmodel = (await import('../../DB/models/subscriptionmodel.js')).default;
        const { getAppConfig } = await import('../appconfig/appconfig.service.js');
        
        const activeSub = await doctorSubscriptionModel.findOne({ doctorId: userId, status: 'active' }).populate({ path: 'subscriptionId', model: subscriptionmodel, select: 'name' });
        
        if (activeSub && activeSub.subscriptionId && activeSub.subscriptionId.name) {
            myCurrentPlanName = activeSub.subscriptionId.name.toLowerCase().replace(' plan', '').trim();
        }
        
        const config = await getAppConfig();
        if (config.commissionRates) {
            if (config.commissionRates.has(myCurrentPlanName)) {
                myCurrentCommissionRate = config.commissionRates.get(myCurrentPlanName);
            } else if (config.commissionRates.has('free')) {
                myCurrentCommissionRate = config.commissionRates.get('free');
            }
        }

        return successresponse({
            res,
            message: "Wallet retrieved successfully",
            data: {
                ...wallet.toObject(),
                grossRevenue: stats.grossRevenue,
                feesPaid: stats.feesPaid,
                netBalance,
                myCurrentPlanName,
                myCurrentCommissionRate
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getMyTransactions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const transactions = await transactionmodel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await transactionmodel.countDocuments({ userId });
        
        return successresponse({
            res,
            message: "Transactions retrieved successfully",
            data: {
                transactions,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Admin endpoints
export const getWalletStats = async (req, res, next) => {
    try {
        const walletmodel = (await import('../../DB/models/walletmodel.js')).default;
        const platformledgermodel = (await import('../../DB/models/platform_ledger_model.js')).default;
        
        const [walletAgg] = await walletmodel.aggregate([
            {
                $group: {
                    _id: null,
                    totalAvailable: { $sum: "$availableBalance" },
                    totalPending: { $sum: "$pendingBalance" }
                }
            }
        ]);
        
        const [ledgerAgg] = await platformledgermodel.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amount" }
                }
            }
        ]);
        
        const [transactionProfits] = await transactionmodel.aggregate([
            { $match: { purpose: 'online_booking_revenue', status: { $ne: 'cancelled' } } },
            { $group: { _id: null, totalPlatformFee: { $sum: '$metadata.platformFee' } } }
        ]);

        const totalRevenue = (ledgerAgg?.totalRevenue || 0) + (transactionProfits?.totalPlatformFee || 0);
        
        return successresponse({
            res,
            message: "Stats retrieved successfully",
            data: {
                totalAvailable: walletAgg?.totalAvailable || 0,
                totalPending: walletAgg?.totalPending || 0,
                totalRevenue: totalRevenue
            }
        });
    } catch (error) {
        next(error);
    }
};

export const manualWalletAdjust = async (req, res, next) => {
    try {
        const { targetUserId, amount, reason, balanceType } = req.body;
        // balanceType: 'available' or 'pending'
        
        if (!amount || amount === 0) {
            throw new Error("Amount cannot be 0");
        }
        if (!reason) {
            throw new Error("Reason is required for manual adjustment");
        }
        
        const type = amount > 0 ? 'credit' : 'debit';
        const absAmount = Math.abs(amount);
        
        const wallet = await getWallet(targetUserId);
        if (amount < 0) {
            if (balanceType === 'pending' && wallet.pendingBalance < absAmount) {
                throw new Error("Insufficient pending balance for this debit");
            }
            if (balanceType !== 'pending' && wallet.availableBalance < absAmount) {
                throw new Error("Insufficient available balance for this debit");
            }
        }

        const walletmodel = (await import('../../DB/models/walletmodel.js')).default;
        
        let updateQuery = {};
        if (balanceType === 'pending') {
            updateQuery = { $inc: { pendingBalance: amount } };
        } else {
            updateQuery = { $inc: { availableBalance: amount } };
        }
        
        const updatedWallet = await walletmodel.findOneAndUpdate(
            { userId: targetUserId },
            updateQuery,
            { new: true, upsert: true }
        );
        
        await transactionmodel.create({
            userId: targetUserId,
            amount: absAmount,
            type: amount > 0 ? 'credit' : 'debit',
            purpose: 'manual_adjustment',
            metadata: { adminNotes: reason, adminId: req.user._id, balanceType }
        });

        const { createNotification } = await import('../notifications/notification.service.js');
        await createNotification({
            userId: targetUserId,
            message: `An adjustment of ${Math.abs(amount)} EGP has been made to your ${balanceType} balance. Reason: ${reason}.`,
            type: "wallet_update",
            link: "/doctor/wallet"
        });
        
        return successresponse({
            res,
            message: "Wallet adjusted successfully",
            data: updatedWallet
        });
    } catch (error) {
        next(error);
    }
};

export const getUserWallet = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const wallet = await getWallet(userId);
        
        return successresponse({
            res,
            message: "User wallet retrieved successfully",
            data: {
                availableBalance: wallet.availableBalance,
                pendingBalance: wallet.pendingBalance
            }
        });
    } catch (error) {
        next(error);
    }
};
