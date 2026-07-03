import { getWallet } from "./wallet.service.js";
import transactionmodel from "../../DB/models/transactionmodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";

export const getMyWallet = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const wallet = await getWallet(userId);
        
        return successresponse({
            res,
            message: "Wallet retrieved successfully",
            data: wallet
        });
    } catch (error) {
        next(error);
    }
};

export const getMyTransactions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const transactions = await transactionmodel.find({ userId }).sort({ createdAt: -1 }).limit(100);
        
        return successresponse({
            res,
            message: "Transactions retrieved successfully",
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};
