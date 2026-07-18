import { Router } from "express";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import appconfigmodel from "../../DB/models/appconfigmodel.js";

const appConfigRouter = Router();

appConfigRouter.get(
    "/",
    authentication,
    authorization([roleenum.admin]),
    async (req, res, next) => {
        try {
            let config = await appconfigmodel.findOne({ isGlobalConfig: true });
            if (!config) {
                config = await appconfigmodel.create({ isGlobalConfig: true });
            }
            return successresponse({ res, data: config, message: "Config fetched" });
        } catch (err) {
            next(err);
        }
    }
);

appConfigRouter.get(
    "/public",
    async (req, res, next) => {
        try {
            let config = await appconfigmodel.findOne({ isGlobalConfig: true });
            if (!config) {
                config = await appconfigmodel.create({ isGlobalConfig: true });
            }
            return successresponse({ 
                res, 
                data: {
                    patientCancellationRefundPercentage: config.patientCancellationRefundPercentage,
                    patientCancellationDoctorCompensationPercentage: config.patientCancellationDoctorCompensationPercentage,
                    patientCancellationPlatformFeePercentage: config.patientCancellationPlatformFeePercentage
                }, 
                message: "Public config fetched" 
            });
        } catch (err) {
            next(err);
        }
    }
);

appConfigRouter.patch(
    "/",
    authentication,
    authorization([roleenum.admin]),
    async (req, res, next) => {
        try {
            const updateData = req.body;
            let config = await appconfigmodel.findOne({ isGlobalConfig: true });
            if (!config) {
                config = await appconfigmodel.create({ isGlobalConfig: true });
            }

            // Update simple fields
            if (updateData.platformFeeFixed !== undefined) config.platformFeeFixed = updateData.platformFeeFixed;
            if (updateData.platformFeePercentage !== undefined) config.platformFeePercentage = updateData.platformFeePercentage;
            if (updateData.patientCancellationRefundPercentage !== undefined) config.patientCancellationRefundPercentage = updateData.patientCancellationRefundPercentage;
            if (updateData.patientCancellationDoctorCompensationPercentage !== undefined) config.patientCancellationDoctorCompensationPercentage = updateData.patientCancellationDoctorCompensationPercentage;
            if (updateData.patientCancellationPlatformFeePercentage !== undefined) config.patientCancellationPlatformFeePercentage = updateData.patientCancellationPlatformFeePercentage;

            // Update Map for commissionRates
            if (updateData.commissionRates) {
                for (const [key, value] of Object.entries(updateData.commissionRates)) {
                    config.commissionRates.set(key, value);
                }
            }

            await config.save();
            return successresponse({ res, data: config, message: "Config updated successfully" });
        } catch (err) {
            next(err);
        }
    }
);

export default appConfigRouter;
