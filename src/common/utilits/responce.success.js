export const successresponse = (
    {
        res,
        status = 200,
        message = "done",
        data = undefined,
        ...rest
    } = {}) => {
    return res.status(status).json({ message, data, ...rest })
}