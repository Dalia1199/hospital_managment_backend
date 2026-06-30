import reviewmodel from "../../DB/models/reviewmodel.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

// POST /reviews/:doctorId — patient adds review
export const addReview = async (req, res, next) => {
    try {
        const { doctorId } = req.params;
        const { rating, comment } = req.body;
        const patientId = req.user._id;

        // patient must have a completed appointment with this doctor
        const completedAppointment = await db_service.findOne({
            model: appointmentsmodel,
            filter: { patientId, doctorId, status: "completed" }
        });

        if (!completedAppointment) {
            throw new Error("you can only review a doctor after a completed appointment", { cause: 403 });
        }

        // check if already reviewed
        const existing = await db_service.findOne({
            model: reviewmodel,
            filter: { patientId, doctorId }
        });

        if (existing) {
            throw new Error("you have already reviewed this doctor", { cause: 409 });
        }

        const review = await db_service.create({
            model: reviewmodel,
            data: { patientId, doctorId, rating, comment }
        });

        return successresponse({ res, status: 201, message: "review added successfully", data: review });
    } catch (error) {
        next(error);
    }
};

// GET /reviews/:doctorId — get all reviews for a doctor
export const getDoctorReviews = async (req, res, next) => {
    try {
        const { doctorId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [reviews, total] = await Promise.all([
            reviewmodel
                .find({ doctorId })
                .populate({ path: "patientId", select: "fullName profilepicture" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            reviewmodel.countDocuments({ doctorId })
        ]);

        // calculate average rating
        const avgResult = await reviewmodel.aggregate([
            { $match: { doctorId: new (await import("mongoose")).default.Types.ObjectId(doctorId) } },
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);

        const averageRating = avgResult[0]?.avgRating?.toFixed(1) ?? 0;

        return successresponse({
            res,
            status: 200,
            message: "reviews fetched successfully",
            data: {
                reviews,
                averageRating,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /reviews/:reviewId — patient deletes their own review
export const deleteReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;

        const review = await db_service.findOne({
            model: reviewmodel,
            filter: { _id: reviewId, patientId: req.user._id }
        });

        if (!review) throw new Error("review not found", { cause: 404 });

        await db_service.deleteOne({ model: reviewmodel, filter: { _id: reviewId } });

        return successresponse({ res, status: 200, message: "review deleted successfully" });
    } catch (error) {
        next(error);
    }
};