import { Router } from "express";

import * as ADS from "./adminDashboard.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { authorization } from "../../common/middleware/authorization.js";

const adminDashboardRouter = Router();

adminDashboardRouter.get(

    "/",

    authentication,

    authorization([

        roleenum.admin

    ]),

    ADS.getDashboard

);

adminDashboardRouter.get(
    "/financial-stats",
    authentication,
    authorization([roleenum.admin]),
    ADS.getFinancialStats
);

//done
adminDashboardRouter.get(
    "/revenue-chart",
    authentication,
    authorization([roleenum.admin]),
    ADS.getRevenueChart
);
//done
adminDashboardRouter.get(
    "/payments",
    authentication,
    authorization([roleenum.admin]),
    ADS.getPaymentsReport
);
adminDashboardRouter.get("/method",
    authentication,
    authorization([roleenum.admin]),
    ADS.getPaymentMethodsChart

);
adminDashboardRouter.get("/staticis",
    authentication,
    authorization([roleenum.admin]),
    ADS.getSubscriptionStatistics

);
adminDashboardRouter.get("/expired",
    authentication,
    authorization([roleenum.admin]),
    ADS.getExpiringSubscriptions

);
adminDashboardRouter.get("/growth",
    authentication,
    authorization([roleenum.admin]),
    ADS.getRevenueGrowth

);
adminDashboardRouter.get("/recent",
    authentication,
    authorization([roleenum.admin]),
    ADS.getRecentSubscriptions

);
adminDashboardRouter.get("/top",
    authentication,
    authorization([roleenum.admin]),
    ADS.getTopSubscriptionPlans

);
export default adminDashboardRouter;