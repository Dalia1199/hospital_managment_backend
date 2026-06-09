import appointsmentmodel from "../../DB/models/appointments_model.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";

import * as db_service from "../../DB/db.service.js";
import availabilitymodel from "../../DB/models/doctor_avaliability.model.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";

export const createslot= async (req, res, next) => {

    try {

        const {date,startTime, endTime} = req.body;

        const existingSlot = await db_service.findOne({

            model: availabilitymodel,

            filter: {

                doctorId: req.user._id,

                date,

                startTime,

                endTime

            }

        });

        if (existingSlot) {

            throw new Error("slot already exists", { cause: 409 });

        }

        const slot = await db_service.create({

            model: availabilitymodel,

            data: {

                doctorId: req.user._id,

                date,

                startTime,

                endTime

            }

        });

        return successresponse({

            res,

            status: 201,

            message: "slot created successfully",

            data: slot

        });

    } catch (error) {

        next(error);

    }

};
export const getAvailableSlots = async (req, res, next) => {

    try {

        const { doctorId } = req.params;

        const slots = await db_service.find({

            model: availabilitymodel,

            filter: {

                doctorId,

                isBooked: false,

                date: {
                    $gte: new Date()
                }

            },

            sort: {

                date: 1

            }

        });

        return successresponse({

            res,

            status: 200,

            message: "available slots getting successfuly",

            data: slots

        });

    } catch (error) {

        next(error);

    }

};


export const bookAppointment = async (req, res, next) => {

    try {

        const {slotId} = req.body;

        const slot = await db_service.findOne({

            model:availabilitymodel,

            filter: {

                _id: slotId

            }

        });

        if (!slot) {

            throw new Error("slot not found", { cause: 404 });

        }

        if (slot.isBooked) {

            throw new Error("slot already booked", { cause: 409 });

        }

        const appointment = await db_service.create({

            model: appointmentsmodel,

            data: {

                patientId: req.user._id,

                doctorId: slot.doctorId,

                slotId: slot._id,


            }

        });

        await db_service.updateOne({

            model:availabilitymodel,

            filter: {

                _id: slotId

            },

            data: {

                isBooked: true

            }

        });

        return successresponse({

            res,

            status: 201,

            message: "appointment booked successfully",

            data: appointment

        });

    } catch (error) {

        next(error);

    }

};
export const getMyAppointments = async (req, res, next) => {

    try {

        const appointments = await db_service.find({

            model: appointmentsmodel,

            filter: {

                patientId: req.user._id

            },

            populate: [

                {
                    path: "doctorId",

                    select: "fullName email profilepicture"
                },

                {
                    path: "slotId"
                }

            ],

            sort: {

                createdAt: -1

            }

        });

        return successresponse({

            res,

            status: 200,

            message: "appointments gets successfully",

            data: appointments

        });

    } catch (error) {

        next(error);

    }

};
export const getDoctorAppointments = async (req, res, next) => {

    try {

        const appointments = await db_service.find({

            model: appointmentsmodel,

            filter: {

                doctorId: req.user._id

            },

            populate: [

                {
                    path: "patientId",

                    select: `
                        fullName
                        email
                        phoneNumber
                        profilepicture
                    `
                },

                {
                    path: "slotId"
                }

            ],

            sort: {

                createdAt: -1

            }

        });

        return successresponse({

            res,

            status: 200,

            message: "doctor appointments gets successfully",

            data: appointments

        });

    } catch (error) {

        next(error);

    }

};
export const cancelAppointment = async (req, res, next) => {

    try {

        const { appointmentId } = req.params;

        const appointment = await db_service.findOne({

            model: appointmentmodel,

            filter: {

                _id: appointmentId,

                patientId: req.user._id

            }

        });

        if (!appointment) {

            throw new Error("appointment not found", { cause: 404 });

        }

        if (appointment.status === "cancelled") {

            throw new Error("appointment already cancelled", { cause: 409 });

        }

        await db_service.updateOne({

            model: appointmentmodel,

            filter: {

                _id: appointmentId

            },

            data: {

                status: "cancelled"

            }

        });

        await db_service.updateOne({

            model: slotmodel,

            filter: {

                _id: appointment.slotId

            },

            data: {

                isBooked: false

            }

        });

        return successresponse({

            res,

            status: 200,

            message: "appointment cancelled successfully"

        });

    } catch (error) {

        next(error);

    }

};