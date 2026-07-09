import supportMessageModel from "../../DB/models/supportmessage.model.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

export const submitMessage = async (req, res, next) => {
    try {
        const { firstName, lastName, email, phone, subject, message } = req.body;
        
        const supportMessage = await db_service.create({
            model: supportMessageModel,
            data: {
                user: req.user._id,
                firstName,
                lastName,
                email,
                phone,
                subject,
                message
            }
        });

        return successresponse({ res, status: 201, message: "Message submitted successfully", data: supportMessage });
    } catch (error) {
        next(error);
    }
};

export const getMessages = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { search, filter } = req.query;

        const query = {};

        if (filter === "unread") {
            query.isRead = false;
        } else if (filter === "read") {
            query.isRead = true;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: "i" } },
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const totalCount = await db_service.count({ model: supportMessageModel, filter: query });
        const totalPages = Math.ceil(totalCount / limit);

        const messages = await db_service.find({
            model: supportMessageModel,
            filter: query,
            options: {
                skip,
                limit,
                sort: { createdAt: -1 }
            }
        });

        return successresponse({
            res,
            status: 200,
            message: "Messages retrieved successfully",
            data: {
                messages,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: totalCount,
                    limit
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const count = await db_service.count({
            model: supportMessageModel,
            filter: { isRead: false }
        });

        return successresponse({ res, status: 200, message: "Unread count retrieved successfully", data: { count } });
    } catch (error) {
        next(error);
    }
};

export const toggleReadStatus = async (req, res, next) => {
    try {
        const { messageId } = req.params;

        const message = await db_service.findOne({
            model: supportMessageModel,
            filter: { _id: messageId }
        });

        if (!message) {
            throw new Error("Message not found", { cause: 404 });
        }

        message.isRead = !message.isRead;
        await message.save();

        return successresponse({ res, status: 200, message: "Message read status updated successfully", data: message });
    } catch (error) {
        next(error);
    }
};
