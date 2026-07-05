import { paymentPurposeEnum, paymentStatusEnum } from "../../common/enum/payment.enum.js";
import paymentmodel from "../../DB/models/paymentmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import { getDateFilter, getNextSevenDays } from "../admin/adminhelper.js";
import transactionmodel from "../../DB/models/transactionmodel.js";
import platformledgermodel from "../../DB/models/platform_ledger_model.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
// /done
 export const getSubscriptionSummary = async () => {

    const {

        today,

        nextWeek

    } = getNextSevenDays();

    const result = await doctorSubscriptionModel.aggregate([

        {

            $facet: {

                active: [

                    {

                        $match: {

                            status:

                                subscriptionStatusEnum.active

                        }

                    },

                    {

                        $count: "count"

                    }

                ],

                expired: [

                    {

                        $match: {

                            status:

                                subscriptionStatusEnum.expired

                        }

                    },

                    {

                        $count: "count"

                    }

                ],

                cancelled: [

                    {

                        $match: {

                            status:

                                subscriptionStatusEnum.cancelled

                        }

                    },

                    {

                        $count: "count"

                    }

                ],

                expiringSoon: [

                    {

                        $match: {

                            status:

                                subscriptionStatusEnum.active,

                            endDate: {

                                $gte: today,

                                $lte: nextWeek

                            }

                        }

                    },

                    {

                        $count: "count"

                    }

                ]

            }

        }

    ]);

    const summary = result[0];

    return {

        active:

            summary.active[0]?.count || 0,

        expired:

            summary.expired[0]?.count || 0,

        cancelled:

            summary.cancelled[0]?.count || 0,

        expiringSoon:

            summary.expiringSoon[0]?.count || 0

    };

};
const getPaymentSummary = async (period) => {

    const result = await paymentmodel.aggregate([

        {

            $facet: {

                totalRevenue: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.paid,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $group: {

                            _id: null,

                            total: {

                                $sum: "$amount"

                            }

                        }

                    }

                ],

                appointmentRevenue: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.paid,

                            purpose: paymentPurposeEnum.appointment,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $group: {

                            _id: null,

                            total: {

                                $sum: "$amount"

                            }

                        }

                    }

                ],

                subscriptionRevenue: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.paid,

                            purpose: paymentPurposeEnum.subscription,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $group: {

                            _id: null,

                            total: {

                                $sum: "$amount"

                            }

                        }

                    }

                ],

                paidPayments: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.paid,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $count: "count"

                    }

                ],

                pendingPayments: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.pending,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $count: "count"

                    }

                ],

                failedPayments: [

                    {

                        $match: {

                            paymentStatus: paymentStatusEnum.failed,

                            ...getDateFilter(period)

                        }

                    },

                    {

                        $count: "count"

                    }

                ]

            }

        }

    ]);

    const summary = result[0];

    return {

        totalRevenue:

            summary.totalRevenue[0]?.total || 0,

        appointmentRevenue:

            summary.appointmentRevenue[0]?.total || 0,

        subscriptionRevenue:

            summary.subscriptionRevenue[0]?.total || 0,

        paidPayments:

            summary.paidPayments[0]?.count || 0,

        pendingPayments:

            summary.pendingPayments[0]?.count || 0,

        failedPayments:

            summary.failedPayments[0]?.count || 0

    };

};
//done
export const getDashboard = async (req,res,next) => {

    try {

        const {

            period = "month" } = req.query;
        const [

            paymentSummary,

            subscriptionSummary

        ] = await Promise.all([

            getPaymentSummary(period),

            getSubscriptionSummary()

        ]);

        return successresponse({

            res,

            message: "Dashboard",

            data: {

                payments:

                    paymentSummary,

                subscriptions:

                    subscriptionSummary

            }

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getRevenueChart = async (req, res, next) => {

    try {

        const data = await paymentmodel.aggregate([

            {

                $match: {

                    paymentStatus: paymentStatusEnum.paid

                }

            },

            {

                $group: {

                    _id: {

                        year: { $year: "$createdAt" },

                        month: { $month: "$createdAt" }

                    },

                    revenue: { $sum: "$amount" }

                }

            },

            {

                $project: {

                    _id: 0,

                    year: "$_id.year",

                    month: "$_id.month",

                    revenue: 1

                }

            },

            {

                $sort: {

                    year: 1,

                    month: 1

                }

            }

        ]);

        return successresponse({

            res,

            message: "Revenue chart fetched successfully",

            data

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getPaymentsReport = async (req, res, next) => {

    try {

        let {

            page = 1,

            limit = 10,

            search,

            status,

            purpose,

            paymentMethod,

            from,

            to,

            sort = "-createdAt"

        } = req.query;

        page = Number(page);

        limit = Number(limit);

        const skip = (page - 1) * limit;

        const match = {};

        if (status) {

            match.paymentStatus = status;

        }

        if (purpose) {

            match.purpose = purpose;

        }

        if (paymentMethod) {

            match.paymentMethod = paymentMethod;

        }

        if (from || to) {

            match.createdAt = {};

            if (from) {

                match.createdAt.$gte = new Date(from);

            }

            if (to) {

                match.createdAt.$lte = new Date(to);

            }

        }

        let sortStage = {

            createdAt: -1

        };

        switch (sort) {

            case "amount":

                sortStage = {

                    amount: 1

                };

                break;

            case "-amount":

                sortStage = {

                    amount: -1

                };

                break;

            case "createdAt":

                sortStage = {

                    createdAt: 1

                };

                break;

            case "-createdAt":

                sortStage = {

                    createdAt: -1

                };

                break;

        }

        const pipeline = [

            {

                $match: match

            },

            {

                $lookup: {

                    from: "users",

                    localField: "userId",

                    foreignField: "_id",

                    as: "user"

                }

            },

            {

                $unwind: {

                    path: "$user",

                    preserveNullAndEmptyArrays: true

                }

            }

        ];

        if (search) {

            pipeline.push({

                $match: {

                    "user.fullName": {

                        $regex: search,

                        $options: "i"

                    }

                }

            });

        }
        pipeline.push(

            {

                $project: {

                    _id: 1,

                    amount: 1,

                    purpose: 1,

                    paymentStatus: 1,

                    paymentMethod: 1,

                    orderId: 1,

                    transactionId: 1,

                    referenceId: 1,

                    createdAt: 1,

                    patient: {

                        _id: "$user._id",

                        fullName: "$user.fullName",

                        email: "$user.email",

                        phoneNumber: "$user.phoneNumber"

                    }

                }

            },

            {

                $sort: sortStage

            },

            {

                $facet: {

                    data: [

                        {

                            $skip: skip

                        },

                        {

                            $limit: limit

                        }

                    ],

                    totalCount: [

                        {

                            $count: "count"

                        }

                    ]

                }

            }

        );

        const result = await paymentmodel.aggregate(pipeline);

        const data = result[0].data;

        const totalItems = result[0].totalCount.length
            ? result[0].totalCount[0].count
            : 0;

        return successresponse({

            res,

            message: "payments fetched successfully",

            data: {

                data,

                pagination: {

                    currentPage: page,

                    totalPages: Math.ceil(totalItems / limit),

                    totalItems,

                    limit

                }

            }

        });

    } catch (error) {

        next(error);

    }

};
//method is undefinded!!!!!need modify
export const getPaymentMethodsChart = async (req, res, next) => {

    try {

        const data = await paymentmodel.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: "$paymentMethod",

                    count: {

                        $sum: 1

                    },

                    totalRevenue: {

                        $sum: "$amount"

                    }

                }

            },

            {

                $project: {

                    _id: 0,

                    paymentMethod: "$_id",

                    count: 1,

                    totalRevenue: 1

                }

            },

            {

                $sort: {

                    totalRevenue: -1

                }

            }

        ]);

        return successresponse({

            res,

            message: "Payment methods fetched successfully",

            data

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getSubscriptionStatistics = async (req, res, next) => {

    try {

        const result = await doctorSubscriptionModel.aggregate([

            {

                $group: {

                    _id: "$status",

                    count: {

                        $sum: 1

                    }

                }

            }

        ]);

        const statistics = {

            total: 0,

            active: 0,

            pending: 0,

            expired: 0,

            cancelled: 0

        };

        result.forEach((item) => {

            statistics.total += item.count;

            statistics[item._id] = item.count;

        });

        return successresponse({

            res,

            message: "Subscription statistics fetched successfully",

            data: statistics

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getExpiringSubscriptions = async (req, res, next) => {

    try {

        const today = new Date();

        const after7Days = new Date();

        after7Days.setDate(today.getDate() + 7);
        const subscriptions = await db_service.find({

            model: doctorSubscriptionModel,

            filter: {
                status: subscriptionStatusEnum.active,
                endDate: {
                    $gte: today,
                    $lte: after7Days
                }
            },

            populate: [
                {
                    path: "doctorId",
                    select: "fullName email phoneNumber"
                },
                {
                    path: "subscriptionId",
                    select: "name price duration"
                }
            ],

            sort: {
                endDate: 1
            }

        });

        return successresponse({

            res,

            message: "Expiring subscriptions fetched successfully",

            data: subscriptions

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getRevenueGrowth = async (req, res, next) => {

    try {

        const now = new Date();

        const currentMonthStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        );

        const previousMonthStart = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );

        const previousMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59
        );

        const revenue = await paymentmodel.aggregate([

            {

                $match: {

                    paymentStatus: "paid",

                    createdAt: {

                        $gte: previousMonthStart

                    }

                }

            },

            {

                $facet: {

                    currentMonth: [

                        {

                            $match: {

                                createdAt: {

                                    $gte: currentMonthStart

                                }

                            }

                        },

                        {

                            $group: {

                                _id: null,

                                revenue: {

                                    $sum: "$amount"

                                }

                            }

                        }

                    ],

                    previousMonth: [

                        {

                            $match: {

                                createdAt: {

                                    $gte: previousMonthStart,

                                    $lte: previousMonthEnd

                                }

                            }

                        },

                        {

                            $group: {

                                _id: null,

                                revenue: {

                                    $sum: "$amount"

                                }

                            }

                        }

                    ]

                }

            }

        ]);

        const currentRevenue =

            revenue[0].currentMonth[0]?.revenue || 0;

        const previousRevenue =

            revenue[0].previousMonth[0]?.revenue || 0;

        let growth = 0;

        if (previousRevenue > 0) {

            growth = (

                (

                    currentRevenue - previousRevenue

                ) /

                previousRevenue

            ) * 100;

        }

        return successresponse({

            res,

            message: "Revenue growth fetched successfully",

            data: {

                currentRevenue,

                previousRevenue,

                growth: Number(

                    growth.toFixed(2)

                )

            }

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getRecentSubscriptions = async (req, res, next) => {

    try {

        const subscriptions = await db_service.find({

            model: doctorSubscriptionModel,

            populate: [

                {
                    path: "doctorId",
                    select: "fullName email phoneNumber"
                },

                {
                    path: "subscriptionId"
                }

            ],

            sort: {

                createdAt: -1

            },

            limit: 10

        });

        return successresponse({

            res,

            message: "Recent subscriptions fetched successfully",

            data: subscriptions

        });

    }

    catch (error) {

        next(error);

    }

};
////////////need to modify it return []
export const getTopSubscriptionPlans = async (req, res, next) => {

    try {

        const plans = await doctorSubscriptionModel.aggregate([

            {
                $group: {

                    _id: "$subscriptionId",

                    subscriptionsCount: {

                        $sum: 1

                    }

                }

            },

            {
                $lookup: {

                    from: "subscriptionplans",

                    localField: "_id",

                    foreignField: "_id",

                    as: "subscription"

                }

            },

            {
                $unwind: "$SubscriptionPlan"
            },

            {
                $project: {

                    _id: 0,

                    subscriptionId: "$subscription._id",

                    name: "$subscription.name",

                    price: "$subscription.price",

                    duration: "$subscription.durationInDays",

                    subscriptionsCount: 1

                }

            },

            {
                $sort: {

                    subscriptionsCount: -1

                }

            }

        ]);

        return successresponse({

            res,

            message: "Top subscription plans fetched successfully",

            data: plans

        });

    }

    catch (error) {

        next(error);

    }

};

export const getFinancialStats = async (req, res, next) => {
    try {
        // 1. Total Doctors Earnings (online_booking_revenue)
        const [doctorEarnings] = await transactionmodel.aggregate([
            { $match: { purpose: 'online_booking_revenue', status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // 2. Platform Profits
        const [transactionProfits] = await transactionmodel.aggregate([
            { $match: { purpose: 'online_booking_revenue', status: { $ne: 'cancelled' } } },
            { $group: { _id: null, totalPlatformFee: { $sum: '$metadata.platformFee' } } }
        ]);

        const platformProfits = await platformledgermodel.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: "$source", total: { $sum: "$amount" } } }
        ]);

        let bookingProfits = transactionProfits?.totalPlatformFee || 0;
        let subscriptionProfits = 0;
        let cancellationProfits = 0;
        
        platformProfits.forEach(p => {
            // We ignore p._id === 'appointment' from ledger since we calculate it from transactions now
            if (p._id === 'subscription') subscriptionProfits = p.total;
            if (p._id === 'cancellation') cancellationProfits = p.total;
        });

        // 3. Cancellation Rate
        const [appointmentStats] = await appointmentsmodel.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    cancelled: {
                        $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                    }
                }
            }
        ]);

        const totalAppointments = appointmentStats?.total || 0;
        const cancelledAppointments = appointmentStats?.cancelled || 0;
        const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;

        return successresponse({
            res,
            message: "Financial Statistics",
            data: {
                totalDoctorsEarnings: doctorEarnings?.total || 0,
                platformBookingProfits: bookingProfits,
                platformSubscriptionProfits: subscriptionProfits,
                platformCancellationProfits: cancellationProfits,
                cancellationRate: parseFloat(cancellationRate.toFixed(2))
            }
        });
    } catch (error) {
        next(error);
    }
};