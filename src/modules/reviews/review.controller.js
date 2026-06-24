import { Router } from "express";
import * as RS from "./review.service.js";
import * as RV from "./review.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

const reviewrouter = Router();

// POST /reviews/:doctorId — patient adds review
reviewrouter.post(
    "/:doctorId",
    authentication,
    authorization([roleenum.patient]),
    validation(RV.addReviewSchema),
    RS.addReview
);

// GET /reviews/:doctorId — get doctor reviews (public)
reviewrouter.get(
    "/:doctorId",
    authentication,
    validation(RV.getDoctorReviewsSchema),
    RS.getDoctorReviews
);

// DELETE /reviews/:reviewId — patient deletes their review
reviewrouter.delete(
    "/:reviewId",
    authentication,
    authorization([roleenum.patient]),
    validation(RV.deleteReviewSchema),
    RS.deleteReview
);


export default reviewrouter;