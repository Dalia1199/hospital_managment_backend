import { Router } from "express";
import * as NS from "./notification.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const notificationrouter = Router();

// GET /notifications
notificationrouter.get(
    "/",
    authentication,
    authorization([roleenum.patient, roleenum.admin]),
    NS.getNotifications
);

// POST /notifications/push-permission
notificationrouter.post(
    "/push-permission",
    authentication,
    authorization([roleenum.patient, roleenum.doctor, roleenum.admin]),
    NS.savePushPermission
);

// PATCH /notifications/read-all
notificationrouter.patch(
    "/read-all",
    authentication,
    authorization([roleenum.patient, roleenum.admin]),
    NS.markAllAsRead
);

// PATCH /notifications/:id/read
notificationrouter.patch(
    "/:id/read",
    authentication,
    authorization([roleenum.patient, roleenum.admin]),
    NS.markAsRead
);

export default notificationrouter;