import usermodel from "../../DB/models/usermodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import * as db_service from "../../DB/db.service.js";
import { roleenum } from "../../common/enum/user.enum.js";

// get all users by role with pagination
export const getallusers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, role } = req.query;

        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(limit);

        const skip = (currentPage - 1) * itemsPerPage;

        const filter = role ? { role } : {};

        const users = await db_service.find({
            model: usermodel,
            filter: filter,
            options: {
                skip: skip,
                limit: itemsPerPage,
                select: "-password"
            }
        });

        const totalCount = await db_service.count({
            model: usermodel,
            filter: filter
        });

        const totalPages = Math.ceil(totalCount / itemsPerPage);

        return successresponse({
            res,
            status: 200,
            message: "Users fetched successfully",
            data: {
                users,
                pagination: {
                    totalCount,
                    totalPages,
                    currentPage,
                    itemsPerPage
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const activateUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await usermodel.findByIdAndUpdate(
            id,
            { status: "active" },
            { new: true }
        )

        if (!user) return next(new Error("User not found"), { cause: 404 });

        return successresponse({ res, status: 200, message: "User activated successfully", data: user });
    }
    catch (error) {
        next(error);
    }
};

export const deactivateUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await usermodel.findByIdAndUpdate(
            id,
            { status: "blocked" },
            { new: true }
        )
        
        if (!user) return next(new Error("User not found"), { cause: 404 });
        
        return successresponse({ res, status: 200, message: "User deactivated successfully", data: user });
    }
    catch (error) {
        next(error);
    }
};
