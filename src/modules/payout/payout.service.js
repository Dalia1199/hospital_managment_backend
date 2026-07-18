import payoutrequestmodel from "../../DB/models/payoutrequestmodel.js";
import { getWallet, deductAvailableBalance } from "../wallet/wallet.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

import cloudinary from "../../common/utilits/cloudinary.js";
import usermodel from "../../DB/models/usermodel.js";
import payoutchangerequestmodel from "../../DB/models/payout_change_request_model.js";

export const setupPayoutProfile = async (req, res, next) => {
    try {
        const { paymentMethod, accountDetails } = req.body;
        const userId = req.user._id;

        const user = await usermodel.findById(userId);
        if (user.payoutProfile?.isSetup) {
            throw new Error("Payout profile is already setup. You must submit a change request to modify it.", { cause: 400 });
        }

        const existingReq = await payoutchangerequestmodel.findOne({ userId, status: 'pending' });
        if (existingReq) {
            throw new Error("You already have a pending setup/change request.", { cause: 400 });
        }

        if (!req.file) {
            throw new Error("ID photo is required for initial setup", { cause: 400 });
        }

        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: `carehub/users/${userId}/payout_id`
        });

        // Create a pending request
        const changeReq = await payoutchangerequestmodel.create({
            userId,
            newPaymentMethod: paymentMethod,
            newAccountDetails: accountDetails,
            idPhotoUrl: secure_url,
            idPhotoPublicId: public_id
        });

        return successresponse({
            res,
            message: "Payout profile setup submitted successfully. It will be reviewed by an admin.",
            data: changeReq
        });
    } catch (error) {
        next(error);
    }
};

export const getMyPayoutProfile = async (req, res, next) => {
    try {
        const user = await usermodel.findById(req.user._id).select('payoutProfile');
        const existingReq = await payoutchangerequestmodel.findOne({ userId: req.user._id, status: 'pending' });
        
        // Find the last rejected request to show the rejection reason to the user
        const lastRejectedReq = await payoutchangerequestmodel.findOne({ userId: req.user._id, status: 'rejected' }).sort({ createdAt: -1 });

        const profileData = user.payoutProfile && user.payoutProfile.isSetup ? user.payoutProfile.toObject() : { isSetup: false };

        return successresponse({
            res,
            message: "Payout profile retrieved",
            data: {
                ...profileData,
                hasPendingRequest: !!existingReq,
                lastRejectedReason: lastRejectedReq ? lastRejectedReq.adminNotes : null
            }
        });
    } catch (error) {
        next(error);
    }
};

export const requestPayoutChange = async (req, res, next) => {
    try {
        const { newPaymentMethod, newAccountDetails } = req.body;
        const userId = req.user._id;

        const user = await usermodel.findById(userId);
        if (!user.payoutProfile?.isSetup) {
            throw new Error("Payout profile is not setup yet.", { cause: 400 });
        }

        // Check for existing pending request
        const existingReq = await payoutchangerequestmodel.findOne({ userId, status: 'pending' });
        if (existingReq) {
            throw new Error("You already have a pending change request.", { cause: 400 });
        }

        if (!req.file) {
            throw new Error("ID photo is required for change requests", { cause: 400 });
        }

        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: `carehub/users/${userId}/payout_change_id`
        });

        const changeReq = await payoutchangerequestmodel.create({
            userId,
            newPaymentMethod,
            newAccountDetails,
            idPhotoUrl: secure_url,
            idPhotoPublicId: public_id
        });

        return successresponse({
            res,
            message: "Change request submitted successfully. It will be reviewed by an admin.",
            data: changeReq
        });
    } catch (error) {
        next(error);
    }
};

export const getMyPayoutMethods = async (req, res, next) => {
    try {
        const payoutmethodmodel = (await import('../../DB/models/payoutmethodmodel.js')).default;
        const methods = await payoutmethodmodel.find({ userId: req.user._id, status: 'approved' }).sort({ createdAt: -1 });

        return successresponse({
            res,
            message: "Payout methods retrieved successfully",
            data: methods
        });
    } catch (error) {
        next(error);
    }
};

export const requestPayout = async (req, res, next) => {
    try {
        const { amount, selectedMethodId } = req.body;
        const userId = req.user._id;

        const user = await usermodel.findById(userId);
        if (!user.payoutProfile?.isSetup) {
            throw new Error("Please setup your payout profile first.", { cause: 400 });
        }

        if (user.payoutProfile?.isSuspended) {
            throw new Error(`Your wallet is suspended. Reason: ${user.payoutProfile.suspendReason}`, { cause: 403 });
        }

        const payoutmethodmodel = (await import('../../DB/models/payoutmethodmodel.js')).default;
        
        let paymentMethodToUse = null;
        let accountDetailsToUse = null;

        if (selectedMethodId) {
            const method = await payoutmethodmodel.findOne({ _id: selectedMethodId, userId, status: 'approved' });
            if (!method) {
                throw new Error("Invalid or unapproved payout method selected.", { cause: 400 });
            }
            paymentMethodToUse = method.methodType;
            accountDetailsToUse = method.accountDetails;
        } else if (user.payoutProfile.paymentMethod && user.payoutProfile.accountDetails) {
            // Fallback to legacy single method
            paymentMethodToUse = user.payoutProfile.paymentMethod;
            accountDetailsToUse = user.payoutProfile.accountDetails;
        } else {
            throw new Error("Please select a payout method.", { cause: 400 });
        }

        const wallet = await getWallet(userId);
        if (wallet.availableBalance < amount) {
            throw new Error("Insufficient available balance", { cause: 400 });
        }

        // Deduct from wallet immediately to prevent double spending
        await deductAvailableBalance(userId, amount, 'payout_withdrawal');

        const payoutReq = await payoutrequestmodel.create({
            userId,
            amount,
            paymentMethod: paymentMethodToUse,
            paymentDetails: accountDetailsToUse,
            selectedMethodId,
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const payouts = await payoutrequestmodel.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await payoutrequestmodel.countDocuments({ userId: req.user._id });

        return successresponse({
            res,
            message: "Payouts retrieved successfully",
            data: {
                payouts,
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

// Admin only
export const getAllPayoutRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(limit);
        const skip = (currentPage - 1) * itemsPerPage;

        const filter = {};

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (search) {
            const usermodel = (await import('../../DB/models/usermodel.js')).default;
            const users = await usermodel.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select('_id');
            
            const userIds = users.map(u => u._id);
            filter.userId = { $in: userIds };
        }

        const total = await payoutrequestmodel.countDocuments(filter);
        const payouts = await payoutrequestmodel.find(filter)
            .populate('userId', 'fullName email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(itemsPerPage);

        return successresponse({
            res,
            message: "All payouts retrieved successfully",
            data: {
                data: payouts,
                pagination: {
                    total,
                    page: currentPage,
                    limit: itemsPerPage,
                    totalPages: Math.ceil(total / itemsPerPage)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const getPendingPayoutsCount = async (req, res, next) => {
    try {
        const withdrawals = await payoutrequestmodel.countDocuments({ status: 'pending' });
        const changes = await payoutchangerequestmodel.countDocuments({ status: 'pending' });
        return successresponse({
            res,
            message: "Pending payouts count retrieved successfully",
            data: { withdrawals, changes, total: withdrawals + changes }
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

        if (status === 'paid') {
            if (!req.file) {
                throw new Error("Receipt photo is required to mark as paid", { cause: 400 });
            }
            const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
                folder: `carehub/payouts/receipts/${requestId}`
            });
            payoutReq.receiptPhoto = { secure_url, public_id };
        }

        payoutReq.status = status;
        if (adminNotes) payoutReq.adminNotes = adminNotes;
        await payoutReq.save();

        if (status === 'rejected') {
            // Refund the deducted amount back to user's wallet
            const { addAvailableBalance } = await import('../wallet/wallet.service.js');
            await addAvailableBalance(payoutReq.userId, payoutReq.amount, 'refund', payoutReq._id, { notes: "Payout rejected" });
        }

        // --- Notification & Email ---
        const user = await usermodel.findById(payoutReq.userId);
        if (user) {
            const notificationmodel = (await import('../../DB/models/notificationmodel.js')).default;
            
            const message = status === 'paid' 
                ? `Your withdrawal request for ${payoutReq.amount} EGP has been approved and paid.`
                : `Your withdrawal request for ${payoutReq.amount} EGP was rejected. Reason: ${adminNotes || 'Contact support'}`;
                
            await notificationmodel.create({
                userId: user._id,
                message,
                type: status === 'paid' ? 'payout_approved' : 'payout_rejected',
                link: `/${user.role}/wallet`
            });

            /*
            // Nodemailer Email (Commented out)
            const sendEmail = (await import('../../common/utilits/email.js')).default;
            await sendEmail({
                to: user.email,
                subject: status === 'paid' ? "Withdrawal Approved" : "Withdrawal Rejected",
                html: `<p>${message}</p>`
            });
            */
        }
        // ----------------------------

        return successresponse({
            res,
            message: `Payout request marked as ${status}`,
            data: payoutReq
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const getAllChangeRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(limit);
        const skip = (currentPage - 1) * itemsPerPage;

        const filter = {};

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (search) {
            const usermodel = (await import('../../DB/models/usermodel.js')).default;
            const users = await usermodel.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select('_id');
            
            const userIds = users.map(u => u._id);
            filter.userId = { $in: userIds };
        }

        const total = await payoutchangerequestmodel.countDocuments(filter);
        const requests = await payoutchangerequestmodel.find(filter)
            .populate('userId', 'fullName email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(itemsPerPage);

        return successresponse({
            res,
            message: "All change requests retrieved successfully",
            data: {
                data: requests,
                pagination: {
                    total,
                    page: currentPage,
                    limit: itemsPerPage,
                    totalPages: Math.ceil(total / itemsPerPage)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const updateChangeRequestStatus = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const { status, adminNotes } = req.body; // 'approved' or 'rejected'

        const changeReq = await payoutchangerequestmodel.findById(requestId);
        if (!changeReq) {
            throw new Error("Change request not found", { cause: 404 });
        }

        if (changeReq.status !== 'pending') {
            throw new Error(`Change request is already ${changeReq.status}`, { cause: 400 });
        }

        changeReq.status = status;
        if (adminNotes) changeReq.adminNotes = adminNotes;
        changeReq.reviewedAt = new Date();

        await changeReq.save();

        if (status === 'approved') {
            const user = await usermodel.findById(changeReq.userId);
            if (user) {
                const payoutmethodmodel = (await import('../../DB/models/payoutmethodmodel.js')).default;
                
                // Create the new verified payout method
                await payoutmethodmodel.create({
                    userId: user._id,
                    methodType: changeReq.newPaymentMethod,
                    accountDetails: changeReq.newAccountDetails,
                    idPhoto: {
                        secure_url: changeReq.idPhotoUrl,
                        public_id: changeReq.idPhotoPublicId
                    },
                    status: 'approved'
                });

                // Ensure the user's base payout profile is marked as setup
                if (!user.payoutProfile?.isSetup) {
                    user.payoutProfile = user.payoutProfile || {};
                    user.payoutProfile.isSetup = true;
                    await user.save();
                }
            }
        }

        // --- Notification & Email ---
        const reqUser = await usermodel.findById(changeReq.userId);
        if (reqUser) {
            const notificationmodel = (await import('../../DB/models/notificationmodel.js')).default;
            
            const message = status === 'approved' 
                ? `Your payout profile setup/change request has been approved.`
                : `Your payout profile setup/change request was rejected. Reason: ${adminNotes || 'Contact support'}`;
                
            await notificationmodel.create({
                userId: reqUser._id,
                message,
                type: status === 'approved' ? 'wallet_setup_approved' : 'wallet_setup_rejected',
                link: `/${reqUser.role}/wallet`
            });

            /*
            // Nodemailer Email (Commented out)
            const sendEmail = (await import('../../common/utilits/email.js')).default;
            await sendEmail({
                to: reqUser.email,
                subject: status === 'approved' ? "Wallet Profile Approved" : "Wallet Profile Rejected",
                html: `<p>${message}</p>`
            });
            */
        }
        // ----------------------------

        return successresponse({
            res,
            message: `Change request ${status}`,
            data: changeReq
        });
    } catch (error) {
        next(error);
    }
};

// Admin only
export const suspendPayoutProfile = async (req, res, next) => {
    try {
        const { userId, isSuspended, suspendReason } = req.body;

        const user = await usermodel.findById(userId);
        if (!user) {
            throw new Error("User not found", { cause: 404 });
        }

        if (!user.payoutProfile) {
            user.payoutProfile = {};
        }

        user.payoutProfile.isSuspended = isSuspended;
        user.payoutProfile.suspendReason = isSuspended ? (suspendReason || "Violation of terms") : "";

        await user.save();

        // Create notification
        const notificationmodel = (await import('../../DB/models/notificationmodel.js')).default;
        await notificationmodel.create({
            userId,
            message: isSuspended ? `Your wallet has been suspended. Reason: ${user.payoutProfile.suspendReason}` : "Your wallet suspension has been lifted.",
            type: "wallet_suspended",
            link: `/${user.role}/wallet`
        });

        /*
        // Nodemailer Example (Commented out)
        const sendEmail = (await import('../../common/utilits/email.js')).default;
        await sendEmail({
            to: user.email,
            subject: isSuspended ? "Wallet Suspended" : "Wallet Restored",
            html: isSuspended ? `<p>Your wallet is suspended: ${user.payoutProfile.suspendReason}</p>` : `<p>Your wallet has been restored.</p>`
        });
        */

        return successresponse({
            res,
            message: `User wallet ${isSuspended ? 'suspended' : 'unsuspended'} successfully`,
            data: user.payoutProfile
        });
    } catch (error) {
        next(error);
    }
};
