

import * as db_service from "../../DB/db.service.js"
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import subscriptionmodel from "../../DB/models/subscriptionmodel.js";
import { subscriptionStatusEnum } from "../enum/subscription.enum.js";



export const checkFeature = (

    featureCode

) => {

    return async (

        req,

        res,

        next

    ) => {

        try {

            const doctorSubscription =

                await db_service.findOne({

                    model:

                        doctorSubscriptionModel,

                    filter: {

                        doctorId:

                            req.user._id,

                        status:

                            subscriptionStatusEnum.active

                    }

                });

            if (

                !doctorSubscription

            ) {

                throw new Error(

                    "No active subscription",

                    {

                        cause: 403

                    }

                );

            }

            if (

                doctorSubscription.endDate < new Date()

            ) {

                throw new Error(

                    "Subscription expired",

                    {

                        cause: 403

                    }

                );

            }

            const plan =

                await db_service.findById({

                    model:

                        subscriptionmodel,

                    id:

                        doctorSubscription.subscriptionId

                });

            if (

                !plan

            ) {

                throw new Error(

                    "Subscription not found",

                    {

                        cause: 404

                    }

                );

            }

            const feature =

                plan.features.find(

                    item =>

                        item.code === featureCode

                );

            if (

                !feature ||

                !feature.enabled

            ) {

                throw new Error(

                    "This feature is not included in your subscription",

                    {

                        cause: 403

                    }

                );

            }

            req.subscription =

                doctorSubscription;

            req.plan =

                plan;

            next();

        }

        catch (error) {

            next(error);

        }

    };

};