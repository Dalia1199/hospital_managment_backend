import { Router } from "express";
import { searchDrugs, seedDrugs } from "./drugs.controller.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";

const router = Router();

router.get("/search", authentication, authorization(["doctor"]), searchDrugs);
router.post("/seed", seedDrugs); // public for now to allow seeding

export default router;
