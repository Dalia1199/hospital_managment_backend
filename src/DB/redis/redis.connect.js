import { createClient } from "redis";
import { redisurl } from "../../../conflig/conflig.service.js";
 export const redisclient=createClient({
    
     url:redisurl
});

    

export const connectionredis =async ()=>{
    await redisclient.connect()
    .then(()=>{
        console.log("connected to redis successfuly");
    })
    .catch ((error)=>{

        console.log ("error to connect with redis",error)
    });
}
