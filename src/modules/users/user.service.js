import usermodel from "../../DB/models/usermodel.js"
import { hash, compare } from "../../common/utilits/security/hash.js";
import* as db_service from "../../DB/db.service.js";
import { decrypt, encrypt } from "../../common/utilits/security/encrypt.js";
import { successresponse } from "../../common/utilits/responce.success.js"
import { providerenum } from "../../common/enum/user.enum.js";
import jwt from "jsonwebtoken";
import {v4 as uuidv4} from "uuid";
import { access_secret_key, Prefix, refreshsecretkey } from "../../../conflig/conflig.service.js";
import { generatetoken,verifytoken } from "../../common/utilits/token.service.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import { block_otp_key, deleletekey, get, get_key, incr, keys, max_otp_key, otp_key, revokedkey, setvalue, ttl } from "../../DB/redis/redis.service.js";
import patientmodel from "../../DB/models/patientmodel.js";
import { generateotp, sendemail } from "../../common/utilits/email/send email.js";
import { eventemitter } from "../../common/utilits/email/email.events.js";
import { emailenum } from "../../common/enum/emailenum.js";
import { emailtemplete } from "../../common/utilits/email/emai.templete.js"
// import { randomUUID } from 'node:crypto'
import doctormodel from "../../DB/models/doctormodel.js"

//done 
const sendemailotp = async ({ email, subject } = {}) => {
    const isblocked = await ttl(block_otp_key({ email }))
    if (isblocked > 0) {
        throw new Error(`you already blocked  please try again  after ${isblocked} seconds`)
    }
    const ttlotp = await ttl(otp_key({ email, subject }))



    if (ttlotp > 0) {

        throw new Error(`you already have otp not expired yet please try again after ${ttlotp} seconds`)
    }

    if (await get(max_otp_key({ email })) >= 3) {
        await setvalue({ key: block_otp_key({ email }), value: 1, ttl: 60 * 60 * 2 })
        throw new Error(`you exceed the maximmu number of trials`)
    }
    const otp = await generateotp()
    eventemitter.emit(emailenum.confirmemail, async () => {
        await sendemail({
            to: email,
            subject: "hello to Carehub app",
            html: emailtemplete(otp)
        })
        await setvalue({ key: otp_key({ email, subject }), value: hash({ plain_text: `${otp}` }), ttl: 60 * 2 })
        await incr(max_otp_key({ email }))
    })

}


//done
export const confirmemail = async (req, res, next) => {
    const { email, code } = req.body
    const otpvalue = await get(otp_key({ email }))
    if (!otpvalue) {
        throw new Error("otp expired");

    }
    if (!compare({
        plain_text: code, cipher_text: otpvalue})) {
        throw new error("invalid otp ");
    }
    const user = await db_service.findOneAndUpdate({
        model: usermodel,
        filter: { email, confirmed: { $exists: false }, provider: providerenum.system },
        update: { confirmed: true }
    })
    if (!user) {
        throw new error("user not exist");
    } 
    await deleletekey(otp_key({ email, subject: emailenum.confirmemail }))
    successresponse({ res, message: "email confirmed successfuly" })

}
//done 
export const resendotp = async (req, res, next) => {
    const { email } = req.body
    const user = await db_service.findOne({
        model: usermodel,
        filter: { email, confirmed: { $exists: false },provider: providerenum.system },
    })
    if (!user) {
        throw new Error("user not exist or already confirmed");
    }
    await sendemailotp({ email, subject: emailenum.confirmemail })

    successresponse({ res, message: "otp sent " })
}
export const refreshtoken = async (req, res, next) => {
    const { authorization } = req.headers
    if (!authorization) {
        throw new error("token not exist");
    }
    const [prefix, token] = authorization.split(" ")
    if (prefix !== Prefix) {
        throw new Error("invalid token prefix");
    }
    const decoded = verifytoken({ token, secret_key: refreshsecretkey })
    if (!decoded || !decoded?.id) {
        throw new Error("invalid token ");
    }
    const user = await db_service.findOne({ model: usermodel, filter: { _id: decoded.id } })
    if (!user) {
        throw new error("user not exist", { cause: 400 })

    }
    res.json({ message: "done " })
}
//done
export const resetPassword = async (req, res, next) => {

    const { email, code, newpassword } = req.body
    const otpvalue = await get(otp_key({ email, subject: emailenum.forgetPassword }))
    if (!otpvalue) {
        throw new Error("otp expire")
    }
    if (!compare({ plain_text: code, cipher_text:otpvalue })) {
        throw new Error("invalid otp")
    }
    const user = await db_service.findOneAndUpdate({
        model: usermodel,
        filter: {
            email,
            provider: providerenum.system,
            confirmed: { $exists: true }
        },
        update: {
            password: await hash({ plain_text: newpassword }),
            changecredential: new Date()
        }
    })
    if (!user) {
        throw new Error("user not exist or invalid provider", { cause: 400 });
    }
    await deleletekey(otp_key({ email, subject: emailenum.forgetPassword }))


    successresponse({ res, message: "success" })
}
//done
export const forgetPassword = async (req, res, next) => {

    const { email } = req.body

    const user = await db_service.findOne({
        model: usermodel,
        filter: { email ,
        provider: providerenum.system,
        confirmed: { $exists: true }
    }
})

    if (!user) { throw new Error("user not found", {cause:400} )}
    await sendemailotp({ email, subject: emailenum.forgetPassword })



    successresponse({ res, message: "successs" })
}
//done
export const UpdatePassword = async (req, res, next) => {

    const { oldpassword, newpassword ,cpassword} = req.body
    if(!compare({plain_text:oldpassword,cipher_text:req.user.password})){
        throw new Error("old password is wrong");
    }

   

    const hashed = hash({plain_text:newpassword})
    req.user.password=hashed
    req.user.changecredential= new Date()

  await req.user.save()

    successresponse({ res, message: "password updated" })
}
//done logout
export const logout = async (req, res, next) => {
    const { flag } = req.query
    if (flag === "all") {
        req.user.changecredential = new Date()
        await req.user.save()
        await deleletekey(await keys(get_key({ userid: req.user._id })))

    } else {
        await setvalue({
            key: revokedkey({ userid: req.user._id, jti: req.decoded.jti }),
            value: `${req.decoded.jti}`,
            ttl: req.decoded.exp - Math.floor(Date.now() / 1000)
        })
    } successresponse({ res })
}
//done
export const updateprofile = async (req, res, next) => {
    let { firstname, lastname, gender, phone } = req.body
    if (phone) { phone = encrypt(phone) }
    const user = await db_service.findOneAndUpdate({
        model: usermodel,
        filter: { _id: req.user._id },
        update: { firstname, lastname, gender , phone }
    })
    if (!user) { throw new Error("user not exist yet") }
    await deleletekey(`profile::${req.user._id}`)
    successresponse({ res, data: user })

}
// export const shareprofile = async (req, res, next) => {
//     const { id } = req.params
//     const user = await db_service.findById({
//         model: usermodel,
//         id,
//         select: "-password"
//     })
//     if (!user) { throw new Error("user not exist yet") }
//     user.phone = decrypt(user.phone)
//     successresponse({ res, data: user })
// }
export const shareprofile = async (req, res, next) => {
    const { id } = req.params

    const user =  db_service.findById({
        model: usermodel,
        id,
        select: "-password"
    })

    if (!user) {
        throw new Error("user not exist yet")
    }

    if (user.phone) {
        user.phone = decrypt(user.phone)
    }

    successresponse({ res, data: user })
}
//done get

export const getprofile = async (req, res, next) => {


    const user = await db_service.findById({
        model: usermodel,
        id: req.decoded.id, select: "-password"
    })
    if (!user) {
        throw new Error("user not found", { cause: 400 });
    }

    successresponse({ res, message: "done", data: { ...user._doc, phone: decrypt(user.phone) } })

    // successresponse({ res, message: "done", data: user })
}
//done
export const signin = async (req, res, next) => {
    const {email,password}=req.body
    const user=await db_service.findOne({model:usermodel,
        filter:{email ,provider:providerenum.system,
            confirmed:{$exists:true}
        }
    })
    if (!user){
        throw new Error("user not exist or invalid provider",{cause:400});
    }
    if (!compare({plain_text:password,cipher_text:user.password})){
        throw new Error("invalid password",{cause:400});
    }


    const uuid = uuidv4()
    const access_token = generatetoken({
        payload: { id: user._id, email: user.email },
        secret_key: access_secret_key,
        options: {
             expiresIn: "25h",

            jwtid: uuid
        }
    })
    const refreshtoken = generatetoken({
        payload: {
            id: user._id, email: user.email
        }, secret_key: refreshsecretkey,
        options: {
            expiresIn: "20h",
            jwtid: uuid
                       
        }

    }) 
    console.log("REFRESH:", refreshtoken); 

    successresponse({ res, message: "success signin", data: { access_token, refreshtoken } })

}
//done 
// export const signup = async (req, res, next) => {

//     const { FullName, email, password, confirmPassword, phoneNumber,role,age,gender,address,
//         bloodType,specialty,syndicateId,nationalId,experience} = req.body;

//     if (await db_service.findOne({
//         model: usermodel,
//         filter: { email }
//     })) {
//         throw new Error("email already exists", { cause: 409 });
//     }

//     if (password !== confirmPassword) {
//         throw new Error("password mismatch");
//     }

//     if (!["doctor", "patient"].includes(role)) {
//         throw new Error("invalid role");
//     }

    

//     let licenseImage = null;
//     try{

//     if (role === "doctor") {
//         if (!req.files?.licenseImage) {
//             throw new Error("license image required");
//         }

//         const { secure_url, public_id } = await cloudinary.uploader.upload(
//             req.files.licenseImage[0].path,
//             { folder: "carehub/doctors" }
//         );

//         licenseImage = { secure_url, public_id };
//     }

  
//     const user = await db_service.create({
//         model: usermodel,
//         data: {
//             FullName,
//             email,
//             password: hash({ plain_text: password }),
//             phoneNumber: encrypt(phoneNumber),
//             role,
//             address
//         }
//     });

//     if (role === "doctor") {

//         await db_service.create({
//             model:doctormodel,
//             data: {
//                 userId: user._id,
//                 specialization: specialty,
//                 nationalId,
//                 experience,
//                 syncdicatedId: syndicateId,
//                 licenseImage: licenseImage

//             }
//         });

//     } else {

//         await db_service.create({
//             model:patientmodel,
//             data: {
//                 userId: user._id,
//                 age,
//                 gender,
//                 bloodtype,
//                 address
//             }
//         });
//         }



//     // const otp = await generateotp();

//     // eventemitter.emit(emailenum.confirmemail, async () => {

//     //     await sendemail({
//     //         to: email,
//     //         subject: "welcome to carehub",
//     //         html: `<p>welcome to Carehub app your otp is: ${otp}</p>`
//     //     });

//     //     await setvalue({
//     //         key: otp_key({ email }),
//     //         value: hash({ plain_text: `${otp}` }),
//     //         ttl: 60 * 2
//     //     });

//     //     await setvalue({
//     //         key: max_otp_key({ email }),
//     //         value: 1,
//     //         ttl: 60 * 3
//     //     });
//     // });

//     successresponse({
//         res,status: 201,message: "signup success",data: user
//     });
// } catch(error){
//     if (licenseImage?.public_id){
//         await cloudinary.uploader.destroy(
//             licenseImage.public_id
//         );
//     }
//     throw error ;
// }
// };
export const signup = async (req, res, next) => {

    const {
        fullName,
        email,
        password,
        confirmPassword,
        phoneNumber,
        role,
        age,
        gender,
        address,
        bloodType,
        specialty,
        syndicateId,
        nationalId,
        experience
    } = req.body;

    if (await db_service.findOne({
        model: usermodel,
        filter: { email }
    })) {
        throw new Error("email already exists", { cause: 409 });
    }

    if (password !== confirmPassword) {
        throw new Error("password mismatch");
    }

    if (!["doctor", "patient"].includes(role)) {
        throw new Error("invalid role");
    }

    let licenseImage = null;
    let nationalIdImage = null;

    try {

        if (role === "doctor") {

            if (!req.files?.licenseImage) {
                throw new Error("license image required");
            }

            const { secure_url, public_id } =
                await cloudinary.uploader.upload(
                    req.files.licenseImage[0].path,
                    { folder: "carehub/doctors" }
                );

            licenseImage = { secure_url, public_id };


            // national id upload
            if (!req.files?.nationalId) {
                throw new Error("national id image required");
            }

            const {
                secure_url: national_secure_url,
                public_id: national_public_id
            } = await cloudinary.uploader.upload(
                req.files.nationalId[0].path,
                { folder: "carehub/nationalIds" }
            );

            nationalIdImage = {
                secure_url: national_secure_url,
                public_id: national_public_id
            };
        }


        const user = await db_service.create({
            model: usermodel,
            data: {
                fullName,
                email,
                password: hash({ plain_text: password }),
                phoneNumber: encrypt(phoneNumber),
                role,
                address
            }
        });


        if (role === "doctor") {

            await db_service.create({
                model: doctormodel,
                data: {
                    userId: user._id,
                    specialization: specialty,
                    nationalId: nationalIdImage,
                    experience,
                    syncdicatedId: syndicateId,
                    licenseimage: licenseImage                }
            });

        } else {

            await db_service.create({
                model: patientmodel,
                data: {
                    userId: user._id,
                    age,
                    gender,
                    bloodtype: bloodType,
                    address
                }
            });
        }
        const otp = await generateotp();

            eventemitter.emit(emailenum.confirmemail, async () => {

                await sendemail({
                    to: email,
                    subject: "welcome to carehub",
                    html: `<p>welcome to Carehub app your otp is: ${otp}</p>`
                });

                await setvalue({
                    key: otp_key({ email }),
                    value: hash({ plain_text: `${otp}` }),
                    ttl: 60 * 2
                });

                await setvalue({
                    key: max_otp_key({ email }),
                    value: 1,
                    ttl: 60 * 3
                });
            });

        successresponse({
            res,
            status: 201,
            message: "signup success",
            data: user
        });

    } catch (error) {

        if (licenseImage?.public_id) {
            await cloudinary.uploader.destroy(
                licenseImage.public_id
            );
        }

        if (nationalIdImage?.public_id) {
            await cloudinary.uploader.destroy(
                nationalIdImage.public_id
            );
        }

        throw error;
    }
};