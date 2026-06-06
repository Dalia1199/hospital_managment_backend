import { emailenum } from "../../common/enum/emailenum.js"
import { redisclient } from "./redis.connect.js"
export const revokedkey = ({ userid, jti }) => {
    return `revoketoken::${userid}::${jti}`
}
export const get_key = ({ userid }) => {
    return `revoketoken::${userid}`
}
export const otp_key = ({ email, subject = emailenum.confirmemail }) => {
    return `otp::${email}::${subject}`
}
export const max_otp_key = ({ email }) => {
    return `otp::${email}::max_tries`
}
export const block_otp_key = ({ email }) => {
    return `${otp_key({ email })}::block`
}

export const setvalue = async ({ key, value, ttl }) => {
    try {
        const data = typeof value === "string" ? value : JSON.stringify(value)
        return ttl ? await redisclient.set(key, data, { EX: ttl }) : await redisclient.set(key, data)
    }
    catch (error) {
        console.log(error, "error on set operation ");

    }

}
export const update = async ({ key, value, ttl }) => {
    try {
        if (!await redisclient.exists(key)) return 0
        return await setvalue({ key, value, ttl })
    }
    catch (error) {
        console.log(error, "error on update operation ");

    }

}
export const get = async (key) => {
    try {
        try { return JSON.parse(await redisclient.get(key)) }
        catch (error) {
            return await redisclient.get(key)
        }

    }
    catch (error) {
        console.log(error, "error on get operation ");

    }

}
export const ttl = async (key) => {
    try {
        return await redisclient.ttl(key)
    }
    catch (error) {
        console.log(error, "error to get ttl operation");
    }
}
export const exists = async (key) => {
    try {
        return await redisclient.exists(key)
    }
    catch (error) {
        console.log(error, "error to get exist operation");
    }
}
export const deleletekey = async (key) => {
    try {
        if (key.length == 0) return 0
        return await redisclient.del(key)
    }
    catch (error) {
        console.log(error, "error on delete operation");

    }

}
export const expire = async ({ key, ttl }) => {
    try {
        return await redisclient.expire(key, ttl)
    }
    catch (error) {
        console.log(error, "error to get exist operation operation");
    }

}
export const keys = async (pattern) => {
    try {
        return await redisclient.keys(`${pattern}*`)
    }
    catch (error) {
        console.log(error, "fail to get keys  operation ");

    }

}

export const incr = async (key) => {
    try {
        return await redisclient.incr(key)
    }
    catch (error) {
        console.log(error, "fail to incr operation ");


    }


}    
