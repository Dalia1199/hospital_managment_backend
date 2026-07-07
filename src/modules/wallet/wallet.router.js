import { Router } from "express";
import * as WC from "./wallet.controller.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";

const walletRouter = Router();

// Fetch my wallet balance
walletRouter.get(
    "/my-wallet",
    authentication,
    WC.getMyWallet
);

import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

// Fetch my transactions ledger
walletRouter.get(
    "/my-transactions",
    authentication,
    WC.getMyTransactions
);

// Admin: Get overall wallet stats and platform revenue
walletRouter.get(
    "/admin/stats",
    authentication,
    authorization([roleenum.admin]),
    WC.getWalletStats
);

// Admin: Get a specific user wallet balance
walletRouter.get(
    "/admin/user-wallet/:userId",
    authentication,
    authorization([roleenum.admin]),
    WC.getUserWallet
);

// Admin: Manually adjust a user's wallet
walletRouter.post(
    "/admin/adjust",
    authentication,
    authorization([roleenum.admin]),
    WC.manualWalletAdjust
);

export default walletRouter;
