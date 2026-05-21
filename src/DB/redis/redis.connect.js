import { createClient } from "redis";
import { redisurl } from "../../../config/config.service.js";
export const redisclient = createClient({

    url: redisurl
});



export const connectionredis = async () => {
    await redisclient.connect()
        .then(() => {
            console.log("connected to redis successfuly");
        })
        .catch((error) => {

            console.log("error to connect with redis", error)
        });
}
