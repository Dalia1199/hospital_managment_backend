// =========================
// BUILD FEATURES MAP
// =========================

export const buildFeaturesMap = (

    features = []

) => {

    const map = {};

    for (const feature of features) {

        map[feature.code] = feature;

    }

    return map;

};

// =========================
// BUILD LIMITS MAP
// =========================

export const buildLimitsMap = (

    limits = []

) => {

    const map = {};

    for (const limit of limits) {

        map[limit.code] = limit.value;

    }

    return map;

};

// =========================
// HAS FEATURE
// =========================

export const hasFeature = (

    plan,

    featureCode

) => {

    const features =

        buildFeaturesMap(

            plan.features

        );

    return !!features[
        featureCode
    ];

};

// =========================
// GET LIMIT
// =========================

export const getLimit = (

    plan,

    limitCode

) => {

    const limits =

        buildLimitsMap(

            plan.limits

        );

    return limits[
        limitCode
    ] ?? 0;

};

// =========================
// IS UNLIMITED
// =========================

export const isUnlimited = (

    value

) => {

    return value === -1;

};

// =========================
// CALCULATE EXPIRE DATE
// =========================

export const calculateExpireDate = (

    duration

) => {

    const expireDate =
        new Date();

    expireDate.setDate(

        expireDate.getDate()

        +

        duration

    );

    return expireDate;

};

// =========================
// CHECK EXPIRED
// =========================

export const isExpired = (

    expireDate

) => {

    return new Date() >

        new Date(expireDate);

};

// =========================
// VALIDATE FEATURES
// =========================

export const validateFeatures = (

    features = []

) => {

    const codes =
        new Set();

    for (const feature of features) {

        if (

            codes.has(

                feature.code

            )

        ) {

            throw new Error(

                `Duplicated feature : ${feature.code}`

            );

        }

        codes.add(

            feature.code

        );

    }

};

// =========================
// VALIDATE LIMITS
// =========================

export const validateLimits = (limits = []) => {

    const set = new Set();

    for (const limit of limits) {

        if (set.has(limit)) {

            throw new Error(`Duplicated feature : ${limit}`);

        }

        set.add(limit);

    }
};