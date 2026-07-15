import * as db_service from "../../DB/db.service.js";
import subscriptionmodel from "../../DB/models/subscriptionmodel.js";

import { successresponse } from "../../common/utilits/responce.success.js"


import {validateFeatures,validateLimits} from "./subscriptionhelper.js";

// =========================
// CREATE PLAN
// =========================

export const createPlan = async (req, res, next) => {

    try {

        const {
            name,
            description,
            price,
            durationInDays,
            features
        } = req.body;

        const planExist =
            await db_service.findOne({
                model: subscriptionmodel,
                filter: { name }
            });

        if (planExist) {

            const error = new Error("subscription plan already exists");
            error.statusCode = 409;
            throw error;
        }

        validateFeatures(features);

       

        const plan =
            await db_service.create({
                model: subscriptionmodel,
                data: {
                    name,
                    description,
                    price,
                    durationInDays,
                    features
                }
            });

        return successresponse({
            res,
            message: "subscription plan created successfully",
            data: plan
        });

    } catch (error) {
        next(error);
    }
};
import appconfigmodel from "../../DB/models/appconfigmodel.js";

// =========================
// GET ALL PLANS
// =========================

export const getPlans = async ( req, res, next) => {

    try {

        let {page = 1,limit = 10,search,sort = "-createdAt",isActive } = req.query;

       page = Number(page);

        limit = Number(limit);

        const filter = {};

        if (search) {

            filter.name = {

                $regex: search,

                $options: "i"

            };

        }

        if (isActive !== undefined) {

            filter.isActive =

                isActive === "true";

        }

        const totalItems =

            await db_service.count({

                model:

                    subscriptionmodel,

                filter

            });

        const plans =

            await db_service.find({

                model:

                    subscriptionmodel,

                filter,

                sort,

                skip:

                    (page - 1) * limit,

                limit

            });

        const config = await appconfigmodel.findOne({ isGlobalConfig: true });
        const commissionRates = config?.commissionRates || new Map();
        const defaultFee = config?.platformFeePercentage || 10;
        
        const plansWithCommission = plans.map(plan => {
            const planObj = plan.toObject ? plan.toObject() : plan;
            const normalizedName = plan.name.toLowerCase().replace(' plan', '').trim();
            let commission = defaultFee;
            if (commissionRates.has(normalizedName)) {
                commission = commissionRates.get(normalizedName);
            }
            planObj.commissionRate = commission;
            return planObj;
        });

        return successresponse({ res,message: "subscription plans fetched successfully",

            data: {

                plans: plansWithCommission,

                pagination: {

                    currentPage:

                        page,

                    totalPages:

                        Math.ceil(

                            totalItems / limit

                        ),

                    totalItems,

                    limit

                }

            }

        });

    }

    catch (error) {

        next(error);

    }

};
// =========================
// GET PLAN BY ID
// =========================

export const getPlanById = async (req,res,next) => {

    try {

        const {planId} = req.params;

        const plan =

            await db_service.findById({

                model:

                    subscriptionmodel,

                id:

                    planId

            });

        if (!plan) {

            throw new Error(

                "subscription plan not found",

                {

                    cause: 404

                }

            );

        }

        return successresponse({res,message: "subscription plan fetched successfully",

            data: {  plan  }

        });

    }

    catch (error) {

        next(error);

    }

};
// =========================
// UPDATE PLAN
// =========================

export const updatePlan = async (req, res, next) => {

    try {

        const {planId} = req.params;

        const plan =

            await db_service.findById({

                model:

                    subscriptionmodel,

                id:

                    planId

            });

        if (!plan) {

            throw new Error(

                "subscription plan not found",

                {

                    cause: 404

                }

            );

        }

        if (req.body.name) {

            const duplicatedPlan =

                await db_service.findOne({

                    model:

                        subscriptionmodel,

                    filter: {

                        name: req.body.name,

                        _id: {

                            $ne: planId

                        }

                    }

                });

            if (duplicatedPlan) {

                throw new Error(

                    "subscription plan already exists",

                    {

                        cause: 409

                    }

                );

            }

        }

        if (req.body.features) {
            validateFeatures(req.body.features);
        }
       

        const updatedPlan =

            await db_service.findOneAndUpdate({

                model:

                    subscriptionmodel,

                filter: {

                    _id: planId

                },

                update: req.body

            });

        return successresponse({

            res,

            message:

                "subscription plan updated successfully",

            data: {

                updatedPlan

            }

        });

    }

    catch (error) {

        next(error);

    }

};
// =========================
// DELETE PLAN
// =========================

export const deletePlan = async ( req, res, next) => {

    try {

        const { planId} = req.params;

        const plan =

            await db_service.findById({

                model:

                    subscriptionmodel,

                id:

                    planId

            });

        if (!plan) {

            throw new Error(

                "subscription plan not found",

                {

                    cause: 404

                }

            );

        }

        await db_service.findOneAndUpdate({

            model:

                subscriptionmodel,

            filter: {

                _id: planId

            },

            update: {

                isActive: false

            }

        });

        return successresponse({res, message: "subscription plan deleted successfully" });

    }

    catch (error) {

        next(error);

    }

};