import { Router } from "express";
import * as WS from "./webauthn.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";

const webauthnrouter = Router();

// Registration
webauthnrouter.post("/register/options", authentication, WS.registerOptions);
webauthnrouter.post("/register/verify", authentication, WS.registerVerification);

// Login
webauthnrouter.post("/login/options", WS.loginOptions);
webauthnrouter.post("/login/verify", WS.loginVerification);

export default webauthnrouter;
