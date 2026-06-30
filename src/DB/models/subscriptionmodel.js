import {

    Schema,

    model

} from "mongoose";

const featureSchema =
    new Schema({

        code: {

            type: String,

            required: true,

            trim: true

        },

        name: {

            type: String,

            required: true,

            trim: true

        },

        enabled: {

            type: Boolean,

            default: true

        }

    }, {
        _id: false
    });

const limitSchema =
    new Schema({

        code: {

            type: String,

            required: true,

            trim: true

        },

        value: {

            type: Number,

            required: true

        }

    }, {
        _id: false
    });

const subscriptionSchema =
    new Schema({

        name: {

            type: String,

            required: true,

            unique: true,

            trim: true

        },

        description: {

            type: String,

            default: ""

        },

        price: {

            type: Number,

            required: true,

            default: 0

        },

        durationInDays: {

            type: Number,

            default: 30

        },

        features: [

            featureSchema

        ],

        

        isActive: {

            type: Boolean,

            default: true

        }

    },

        {

            timestamps: true

        });

const subscriptionmodel =
    model(

        "SubscriptionPlan",

        subscriptionSchema

    );

export default
    subscriptionmodel;