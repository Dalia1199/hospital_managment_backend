import { access_secret_key, refreshsecretkey } from "../../../config/config.service.js";
import usermodel from "../../DB/models/usermodel.js";
import { get, revokedkey } from "../../DB/redis/redis.service.js";
import { verifytoken } from "../utilits/token.service.js"
import * as db_service from "../../DB/db.service.js"


export const authentication = async (req, res, next) => {
    const { authorization } = req.headers
    if (!authorization) {
        throw new Error("token not exist");
    }
    const [prefix, token] = authorization.split(" ")
    if (prefix !== prefix) {
        throw new Error("invalid token prefix");
    }
    const decoded = verifytoken({ token, secret_key: access_secret_key })
    if (!decoded || !decoded?.id) {
        throw new Error("invalid token ");
    }
    const user = await db_service.findOne({ model: usermodel, filter: { _id: decoded.id } })
    if (!user) {
        throw new Error("user not exist", { cause: 400 })
    }
    if (user?.changecredential?.getTime() > decoded.iat * 1000) {
        throw new Error("token expired ");
    }
    const revoketoken = await get(revokedkey({ userid: decoded.id, jti: decoded.jti }))
    if (revoketoken) {
        throw new Error("invalid token revoked");
    }
    req.user = user
    req.decoded = decoded

    next()
}



