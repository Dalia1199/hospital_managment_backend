import appconfigmodel from "../../DB/models/appconfigmodel.js";

export const getAppConfig = async () => {
    let config = await appconfigmodel.findOne({ isGlobalConfig: true });
    if (!config) {
        config = await appconfigmodel.create({ isGlobalConfig: true });
    }
    return config;
};

export const calculateCommission = async (amount, doctorId = null) => {
    const config = await getAppConfig();
    let platformFee = 0;
    
    // By default, try to use dynamic commission rates if we have a doctorId
    if (doctorId && config.commissionRates) {
        let planName = 'free'; // default to free if no active plan
        const doctorSubscriptionModel = (await import('../../DB/models/doctor.subscription.js')).default;
        const subscriptionmodel = (await import('../../DB/models/subscriptionmodel.js')).default;
        
        const activeSub = await doctorSubscriptionModel.findOne({ doctorId, status: 'active' }).populate({ path: 'subscriptionId', model: subscriptionmodel, select: 'name' });
        
        if (activeSub && activeSub.subscriptionId && activeSub.subscriptionId.name) {
            planName = activeSub.subscriptionId.name.toLowerCase().replace(' plan', '').trim();
        }
        
        let rate = 10; // Default fallback
        if (config.commissionRates.has(planName)) {
            rate = config.commissionRates.get(planName);
        } else if (config.commissionRates.has('free')) {
            rate = config.commissionRates.get('free');
        }
        
        platformFee = Math.round((amount * rate) / 100 * 100) / 100;
    } else {
        // Fallback to legacy fixed/percentage if no doctor or no map
        if (config.platformFeePercentage > 0) {
            platformFee = Math.round((amount * config.platformFeePercentage) / 100 * 100) / 100;
        } else {
            platformFee = config.platformFeeFixed;
        }
    }
    
    const doctorShare = Math.max(0, Math.round((amount - platformFee) * 100) / 100);
    
    return { platformFee, doctorShare };
};

export const calculateRefundSplit = async (amount) => {
    const config = await getAppConfig();
    
    const patientRefund = Math.round((amount * config.patientCancellationRefundPercentage) / 100 * 100) / 100;
    const doctorCompensation = Math.round((amount * config.patientCancellationDoctorCompensationPercentage) / 100 * 100) / 100;
    const platformFee = Math.round((amount * config.patientCancellationPlatformFeePercentage) / 100 * 100) / 100;
    
    return { patientRefund, doctorCompensation, platformFee };
};
