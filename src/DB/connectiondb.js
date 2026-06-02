
import mongoose from "mongoose"
import { db_uri, DB_URL_ONLINE } from "../../config/config.service.js"


const checkConnectionDB = async () => {
    await mongoose.connect(db_uri, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log(`DB is connected successfuly ${db_uri}😊😊`)
        })
        .catch((error) => {
            console.log(error, "fail to connect to DB😒😒")
        })
}
export default checkConnectionDB
