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

// Fetch my transactions ledger
walletRouter.get(
    "/my-transactions",
    authentication,
    WC.getMyTransactions
);

export default walletRouter;
