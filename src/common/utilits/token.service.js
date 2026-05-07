import JsonWebToken from "jsonwebtoken";

export const generatetoken = ({ payload, secret_key, options = {} } = {}) => {
    return JsonWebToken.sign(payload, secret_key, options)
}

export const verifytoken = ({ token, secret_key, options = {} } = {}) => {
    return JsonWebToken.verify(token, secret_key, options)
}