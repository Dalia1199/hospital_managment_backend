import dotenv from "dotenv"
import { resolve } from "node:path"




const NODE_ENV = process.env.NODE_ENV;
let envpaths = {
    development: ".env.development",
    production: ".env.production"
}
dotenv.config({ path: resolve(`conflig/${envpaths[NODE_ENV]}`) })
export const PORT = +process.env.PORT;
export const access_secret_key = process.env.ACCESS_SECRET_KEY
export const db_uri = process.env.DB_URL
export const saltrounds = process.env.SALT_ROUNDS
export const refreshsecretkey = process.env.REFRESH_SECRET_KEY
export const Prefix = process.env.PREFIX
export const redisurl = process.env.REDIS_URL
export const Email = process.env.EMAIL
export const password = process.env.PASSWORD
export const CLOUDINARY_CLOUD_NAME =process.env.CLOUDINARY_CLOUD_NAME
export const CLOUDINARY_API_KEY= process.env.CLOUDINARY_API_KEY
export const CLOUDINARY_API_SECRET=process.env.CLOUDINARY_API_SECRET