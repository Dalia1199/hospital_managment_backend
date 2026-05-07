
export const authorization = (roles = []) => {
    return async (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "not authorized" });
        }

        next();

    }
}
