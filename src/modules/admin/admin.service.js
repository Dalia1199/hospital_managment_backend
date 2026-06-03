import usermodel from "../../DB/models/usermodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";

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