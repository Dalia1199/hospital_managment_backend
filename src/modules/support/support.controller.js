import { Router } from "express";
import * as SS from "./support.service.js";
import * as SV from "./support.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { validation } from "../../common/middleware/validation.js";
import { roleenum } from "../../common/enum/user.enum.js";

const supportrouter = Router();

// Submit a new support message (Any authenticated user)
supportrouter.post(
    "/",
    authentication,
    validation(SV.submitMessageSchema),
    SS.submitMessage
);

// Get paginated messages (Admin only)
supportrouter.get(
    "/",
    authentication,
    authorization([roleenum.admin]),
    SS.getMessages
);

// Get unread messages count (Admin only)
supportrouter.get(
    "/unread-count",
    authentication,
    authorization([roleenum.admin]),
    SS.getUnreadCount
);

// Toggle read status (Admin only)
supportrouter.patch(
    "/:messageId/read",
    authentication,
    authorization([roleenum.admin]),
    validation(SV.messageIdSchema),
    SS.toggleReadStatus
);

export default supportrouter;
