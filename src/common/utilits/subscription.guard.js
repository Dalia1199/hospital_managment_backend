import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import { subscriptionStatusEnum } from "../enum/subscription.enum.js";
import * as db_service from "../../DB/db.service.js";

/**
 * Returns the currently active subscription for a doctor, or null if Free/None.
 */
export async function getActivePlanForUser(doctorId) {
    const sub = await db_service.findOne({
        model: doctorSubscriptionModel,
        filter: { doctorId, status: subscriptionStatusEnum.active },
        populate: [{ path: "subscriptionId" }]
    });

    if (!sub || !sub.subscriptionId) return null;
    
    // Check if subscription has expired
    const endDate = new Date(sub.endDate);
    if (endDate < new Date()) return null;

    return sub;
}

/**
 * Returns the max clinics limit for a doctor.
 * 0 = Free (self-only)
 * 1 = Silver, 2 = Gold, -1 = Premium (unlimited)
 */
export async function getClinicLimit(doctorId) {
    const sub = await getActivePlanForUser(doctorId);
    if (!sub) return 1; // Free Plan default

    const limitObj = sub.subscriptionId?.limits?.find(l => l.code === 'maxClinics');
    let limitValue = limitObj !== undefined ? limitObj.value : undefined;

    // Fallback if maxClinics is missing or explicitly 0 but plan is paid
    const planName = sub.subscriptionId?.name?.toLowerCase() || '';
    if (planName.includes('premium')) return limitValue === undefined || limitValue === 0 ? -1 : limitValue;
    if (planName.includes('gold')) return limitValue === undefined || limitValue === 0 ? 2 : limitValue;
    if (planName.includes('silver')) return limitValue === undefined || limitValue === 0 ? 1 : limitValue;
    
    return limitValue !== undefined ? limitValue : 0;
}

/**
 * Checks if the user's plan has a specific feature enabled.
 */
export async function hasFeature(doctorId, featureCode) {
    const sub = await getActivePlanForUser(doctorId);
    if (!sub) {
        // Free plan defaults
        if (featureCode === 'online_booking') return true;
        return false;
    }

    const feature = sub.subscriptionId.features?.find(f => f.code === featureCode);
    return feature ? feature.enabled : false;
}

/**
 * Gets all active features as an array of objects.
 */
export async function getActiveFeatures(doctorId) {
    const sub = await getActivePlanForUser(doctorId);
    if (!sub) {
        // Free plan defaults
        return [{ code: 'online_booking', name: 'Online Booking', enabled: true }];
    }
    return sub.subscriptionId.features || [];
}

/**
 * Gets the current plan name.
 */
export async function getPlanName(doctorId) {
    const sub = await getActivePlanForUser(doctorId);
    return sub ? sub.subscriptionId.name : "Free Plan";
}
