import appconfigmodel from "../../DB/models/appconfigmodel.js";

export const getAppConfig = async () => {
    let config = await appconfigmodel.findOne({ isGlobalConfig: true });
    if (!config) {
        config = await appconfigmodel.create({ isGlobalConfig: true });
    }
    return config;
};

export const calculateCommission = async (amount) => {
    const config = await getAppConfig();
    let platformFee = 0;
    
    if (config.platformFeePercentage > 0) {
        platformFee = (amount * config.platformFeePercentage) / 100;
    } else {
        platformFee = config.platformFeeFixed;
    }
    
    const doctorShare = Math.max(0, amount - platformFee);
    
    return { platformFee, doctorShare };
};

export const calculateRefundSplit = async (amount) => {
    const config = await getAppConfig();
    
    const patientRefund = (amount * config.patientCancellationRefundPercentage) / 100;
    const doctorCompensation = (amount * config.patientCancellationDoctorCompensationPercentage) / 100;
    const platformFee = (amount * config.patientCancellationPlatformFeePercentage) / 100;
    
    return { patientRefund, doctorCompensation, platformFee };
};
