import cron from "node-cron";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import { subscriptionStatusEnum } from "../enum/subscription.enum.js";





export const subscriptionCron = () => {

    cron.schedule(

        "0 0 * * *",

        async () => {

            try {

                await doctorSubscriptionModel.updateMany(

                    {

                        status:

                            subscriptionStatusEnum.active,

                        endDate: {

                            $lt: new Date()

                        }

                    },

                    {

                        status:

                            subscriptionStatusEnum.expired

                    }

                );

                console.log(

                    `Expired ${result.modifiedCount} subscriptions`

                );

            }

            catch (error) {

                console.log(error);

            }

        }

    );

};