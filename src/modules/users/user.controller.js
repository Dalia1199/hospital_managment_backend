import { Router } from "express";
import *as US from "../users/user.service.js"
import * as UV from "../users/user.validation.js"
import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
const userrouter = Router()




userrouter.post(
    "/signup",
    multer_host(multerenum.image).fields([
        { name: "licenseImage", maxCount: 1 },
        { name: "nationalId", maxCount: 1 }
    ]),
    validation(UV.signupschema),
    US.signup
);
userrouter.post("/logout", authentication, US.logout)
userrouter.post("/signin", validation(UV.signinschema), US.signin)
userrouter.patch("/update-password", authentication, validation(UV.updatepassworsschema), US.UpdatePassword)
userrouter.get("/profile", authentication, US.getprofile)
userrouter.get("/share-profile/:id"
    // ,validation(UV.shareprofileschema)
    ,US.shareprofile)
userrouter.patch("/update-profile", authentication, validation(UV.updateprofileschema), US.updateprofile)
userrouter.patch("/forget-password", validation(UV.resendotpschema),US.forgetPassword)
userrouter.post("/reset-password", validation(UV.resetpasswordschema), US.resetPassword)
userrouter.patch("/confirm-email", validation(UV.confirmemailschema), US.confirmemail)
userrouter.post("/resend-otp", validation(UV.resendotpschema), US.resendotp)
userrouter.get("/refresh-token", US.refreshtoken)
export default userrouter