import mongoose, {

    Schema,

    Types,

    model

} from "mongoose";

import {

    subscriptionStatusEnum

} from "../../common/enum/subscription.enum.js";

const doctorSubscriptionSchema = new Schema({

    doctorId: {

        type: Types.ObjectId,

        ref: "user",

        required: true

    },

    subscriptionId: {

        type: Types.ObjectId,

        ref: "SubscriptionPlan",

        required: true

    },

    paymentId: {

        type: Types.ObjectId,

        ref: "payment"

    },

    startDate: {

        type: Date,

        default: Date.now

    },

    endDate: {

        type: Date,

        required: true

    },

    status: {

        type: String,

        enum: Object.values(

            subscriptionStatusEnum

        ),

        default:

            subscriptionStatusEnum.pending

    },

    autoRenew: {

        type: Boolean,

        default: false

    },
    cancelledAt: {

        type: Date

    },

    cancelledBy: {

        type: Schema.Types.ObjectId,

        ref: "user"

    },

    cancelReason: {

        type: String,

        trim: true

    },

},

    {

        timestamps: true

    });

const doctorSubscriptionModel =

    model(

        "DoctorSubscription",

        doctorSubscriptionSchema

    );

export default doctorSubscriptionModel;