import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import * as db_service from "../../DB/db.service.js";
import usermodel from "../../DB/models/usermodel.js";
import doctormodel from "../../DB/models/doctormodel.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import paymentmodel from "../../DB/models/paymentmodel.js";
import { paymentPurposeEnum, paymentStatusEnum } from "../../common/enum/payment.enum.js";

export const getSubscriptionSummary = async ({ doctorId }) => {

    const subscription = await db_service.findOne({

        model: doctorSubscriptionModel,

        filter: {
            doctorId,
            status: subscriptionStatusEnum.active
        },

        populate: [
            {
                path: "subscriptionId",
                select: "name price durationInDays features"
            }
        ],

        lean: true

    });

    if (!subscription) {

        return {
            hasSubscription: false
        };

    }

    const today = new Date();

    const daysRemaining = Math.max(
        0,
        Math.ceil(
            (new Date(subscription.endDate) - today) /
            (1000 * 60 * 60 * 24)
        )
    );

    return {

        hasSubscription: true,

        plan: subscription.subscriptionId,

        status: subscription.status,

        startDate: subscription.startDate,

        endDate: subscription.endDate,

        autoRenew: subscription.autoRenew,

        daysRemaining

    };

};
export const getRevenueSummary = async ({ doctorId }) => {
    
    const doctor = await db_service.findOne({

        model:doctormodel,

        filter: {

            _id: doctorId

        },

        select: "consultationFee",

        lean: true

    });
    console.log(doctorModel.collection.name);

    const doctors = await doctorModel.find().limit(5);

    console.log(doctors);;


    const consultationFee = doctor?.consultationFee ;

    const today = new Date();

    const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    const startOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const [

        paidAppointments,

        unpaidAppointments,

        todayPaidAppointments,

        monthPaidAppointments

    ] = await Promise.all([

        db_service.count({

            model: appointmentsmodel,

            filter: {

                doctorId,

                paymentStatus: "paid"

            }

        }),

        db_service.count({

            model: appointmentsmodel,

            filter: {

                doctorId,

                paymentStatus: "unpaid"

            }

        }),

        db_service.count({

            model: appointmentsmodel,

            filter: {

                doctorId,

                paymentStatus: "paid",

                createdAt: {

                    $gte: startOfToday

                }

            }

        }),

        db_service.count({

            model: appointmentsmodel,

            filter: {

                doctorId,

                paymentStatus: "paid",

                createdAt: {

                    $gte: startOfMonth

                }

            }

        })

    ]);

    return {

        consultationFee,

        paidAppointments,

        unpaidAppointments,

        totalRevenue:

            paidAppointments * consultationFee,

        todayRevenue:

            todayPaidAppointments * consultationFee,

        monthRevenue:

            monthPaidAppointments * consultationFee

    };

};
export const getSubscriptionPaymentsSummary = async ({ doctorId }) => {

    const payments = await db_service.find({

        model: paymentmodel,

        filter: {

            userId: doctorId,

            purpose: paymentPurposeEnum.subscription,

            paymentStatus: paymentStatusEnum.paid

        },

        sort: {

            createdAt: -1

        },

        lean: true

    });

    if (!payments.length) {

        return {

            paymentsCount: 0,

            totalPaid: 0,

            lastPaymentAmount: 0,

            lastPaymentDate: null

        };

    }

    const totalPaid = payments.reduce(

        (sum, payment) => sum + payment.amount,

        0

    );

    return {

        paymentsCount: payments.length,

        totalPaid,

        lastPaymentAmount: payments[0].amount,

        lastPaymentDate: payments[0].createdAt

    };

};
export const getDashboard = async ({ doctorId}) => {

    const [

        subscription,

        revenue,

        subscriptionPayments

    ] = await Promise.all([

        getSubscriptionSummary(doctorId),

        getRevenueSummary(doctorId),

        getSubscriptionPaymentsSummary(doctorId)

    ]);

    return {

        subscription,

        revenue,

        subscriptionPayments

    };

};