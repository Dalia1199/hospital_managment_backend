import { EventEmitter } from "node:events";
import {emailenum} from "../../enum/emailenum.js";
export const eventemitter = new EventEmitter();
 eventemitter.on(emailenum.confirmemail,async(fn)=>{
    await fn()
 })
