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


////////for protected route by nermen


exports.protect = catchAsync( async (req, res, next) => {
    let token;

    //1- geting token and check if token exist
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) { return next(new AppError('You are not logged in! Please log in to get access.', 401)); }

      //2- verification token
    const decoded = await promisify(jwt.verify)(token, process.env.ACCESS_SECRET_KEY);

    //3- check if user still exist
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) { return next(new AppError('The user belonging to this token does no longer exist.', 401)); } 

    //4- check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) { return next(new AppError('User recently changed password! Please log in again.', 401)); }      

    //GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();

}
)


//to restrict access to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {    
            return next(new AppError('You do not have permission to perform this action', 403));
        }}
           }
