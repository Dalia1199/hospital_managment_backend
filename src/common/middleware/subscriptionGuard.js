import * as db_service from "../../DB/db.service.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import clinicmodel from "../../DB/models/clinic_model.js";
import { subscriptionStatusEnum } from "../enum/subscription.enum.js";
import { buildFeaturesMap, buildLimitsMap } from "../../modules/subscription/subscriptionhelper.js";

const getDoctorActiveSubscription = async (doctorId) => {
    const activeSub = await db_service.findOne({
        model: doctorSubscriptionModel,
        filter: {
            doctorId,
            status: subscriptionStatusEnum.active
        },
        populate: [
            { path: "subscriptionId" }
        ]
    });

    if (activeSub && activeSub.subscriptionId) {
        return activeSub.subscriptionId;
    }

    // Default Free Tier features
    return {
        name: "Free",
        price: 0,
        features: [
            { code: "reports", enabled: false },
            { code: "ai", enabled: false },
            { code: "assistants", enabled: false }
        ],
        limits: [
            { code: "clinics", value: 1 }
        ]
    };
};

export const requireFeature = (featureCode) => {
    return async (req, res, next) => {
        try {
            const plan = await getDoctorActiveSubscription(req.user._id);
            const features = buildFeaturesMap(plan.features || []);

            const hasFeature = features[featureCode] && features[featureCode].enabled !== false;

            if (!hasFeature) {
                return res.status(403).json({
                    message: `Feature '${featureCode}' requires an active subscription upgrade.`
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

export const requireClinicSlot = () => {
    return async (req, res, next) => {
        try {
            const plan = await getDoctorActiveSubscription(req.user._id);
            const limits = buildLimitsMap(plan.limits || []);
            
            const clinicLimit = limits["clinics"] !== undefined ? limits["clinics"] : (limits["maxClinics"] !== undefined ? limits["maxClinics"] : 1);

            if (clinicLimit === -1) {
                return next(); // Unlimited
            }

            const currentClinicsCount = await db_service.count({
                model: clinicmodel,
                filter: { doctorId: req.user._id, isActive: true }
            });

            if (currentClinicsCount >= clinicLimit) {
                return res.status(403).json({
                    message: `You have reached your clinic limit (${clinicLimit}). Please upgrade your plan to add more clinics.`
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
