import express from "express";
import { PORT } from "../conflig/conflig.service.js";
import checkConnectionDB from "./DB/connectiondb.js";
import userrouter from "./modules/users/user.controller.js";
import { connectionredis } from "./DB/redis/redis.connect.js";
import questionrouter from "./modules/questions/questions.controller.js";
import answerrouter from "./modules/answers/answer.controller.js";
const app = express();
const Port=PORT||3000;

const bootstrap= () => {
    app.use(express.json());

    app.get("/", (req, res, next) => {
        res.status(200).json({ message: `welcome to carehub app😊` })
    })
    checkConnectionDB()
    connectionredis()

app.use("/users", userrouter),
app.use("/questions", questionrouter)
 app.use("/answers", answerrouter);
    // app.use("*", (req, res, next) => {
    //     throw new Error(`url ${req.originalUrl} is not found`, { cause: 404 });
    // })
    app.use("{/*demo}", (req, res, next) => {
      throw new Error(`url ${req.originalUrl} is not found😒😒`,{ cause: 404 });
    })
    app.use((err, req, res, next) => {
        res.status(err.cause||500).json({ message: err.message, stack: err.stack })
    })
  
app.listen(Port,()=>{console.log(`Server is running on port ${Port}`)});









}









export default bootstrap;