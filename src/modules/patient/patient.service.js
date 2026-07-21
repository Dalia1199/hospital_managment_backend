import patientmodel from "../../DB/models/patientmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import usermodel from "../../DB/models/usermodel.js";
import { decrypt, encrypt, hashPhone } from "../../common/utilits/security/encrypt.js";
import prescriptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import healthtrackingmodel from "../../DB/models/healthtrackingmodel.js";
import medicationtrackingmodel from "../../DB/models/medicationtrackingmodel.js";
import { parseDuration, parseFrequency } from "../../common/utilits/medicationHelper.js";
import medicationschedulemodel from "../../DB/models/medicationschedulemodel.js";

export const getMyPrescriptions = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {
    patientId: req.user._id,
  };

  const totalCount = await db_service.count({ model: prescriptionmodel, filter });
  const totalPages = Math.ceil(totalCount / limit);

  const prescriptions = await db_service.find({
    model: prescriptionmodel,
    filter,
    options: {
      populate: [
        {
          path: "doctorId",
          select: "fullName email",
        },
        {
          path: "medicalHistoryId",
        },
      ],
      skip,
      limit,
      sort: { createdAt: -1 },
      lean: true
    }
  });

  successresponse({
    res,
    data: prescriptions,
    pagination: { totalPages, currentPage: page, totalRecords: totalCount }
  });
};
export const getSinglePrescription = async (req, res, next) => {
  const { prescriptionId } = req.params;

  const prescription = await db_service.findOne({
    model: prescriptionmodel,
    filter: {
      _id: prescriptionId,
      patientId: req.user._id,
    },
    populate: [
      {
        path: "doctorId",
        select: "fullName email",
      },
      {
        path: "medicalHistoryId",
      },
    ],
  });

  if (!prescription) {
    throw new Error("prescription not found", { cause: 404 });
  }

  successresponse({
    res,
    data: prescription,
  });
};
// //done
// export const updatePatientProfile = async (req, res, next) => {

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: req.body

//     })

//     successresponse({
//         res,
//         message: "profile updated successfully",
//         data: user
//     })

// }
// //done
// export const uploadProfileImage = async (req, res, next) => {
//     console.log("BEFORE CLOUDINARY");
//     if (!req.file) {
//         throw new Error("image required", { cause: 400 })
//     }
//     console.log("CLOUD NAME:", process.env.CLOUD_NAME);
//     console.log("API KEY:", process.env.API_KEY);
//     const { secure_url, public_id } =
//         await cloudinary.uploader.upload(req.file.path, {

//             folder: "carehub/patient"

//         })

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {

//             profilepicture: {
//                 secure_url,
//                 public_id
//             }

//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: "profile image uploaded successfully",

//         data: user

//     })

// }
// //done
// export const deleteProfileImage = async (req, res, next) => {

//     if (!req.user.profilepicture?.public_id) {
//         throw new Error("image not found", { cause: 404 })
//     }

//     await cloudinary.uploader.destroy(
//         req.user.profilepicture.public_id
//     )

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {
//             profilepicture: null
//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: " profilepicture deleted successfully",

//         data: user

//     })

// }

// //done
// export const getMyProfile = async (req, res, next) => {

//     const user = await db_service.findOne({

//         model: usermodel,

//         filter: {
//             _id: req.user._id,
//             role: roleenum.patient
//         },

//         select: `
//             fullName
//             email
//             phoneNumber
//             age
//             gender
//             bloodType
//             address
//             profilepicture
//             role
//         `

//     })

//     if (!user) {
//         throw new Error("patient not found", { cause: 404 })
//     }

//     const userdata = user.toObject()

//     if (userdata.phoneNumber) {
//         userdata.phoneNumber = decrypt(userdata.phoneNumber)
//     }

//     successresponse({

//         res,

//         data: userdata

//     })

// }
// //done
// export const updateProfileImage = async (req, res, next) => {

//     if (!req.file) {
//         throw new Error("image is required", { cause: 400 })
//     }

//     if (req.user.image?.public_id) {

//         await cloudinary.uploader.destroy(
//             req.user.image.public_id
//         )

//     }

//     const { secure_url, public_id } =
//         await cloudinary.uploader.upload(req.file.path, {

//             folder: "carehub/patient"

//         })

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {

//             image: {
//                 secure_url,
//                 public_id
//             }

//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: "profile image updated successfully",

//         data: user

//     })

// }

// ─── GET /patient/profile ─────────────────────────────────────────────────────
// يجيب user data + patient data (age, gender, bloodType, allergies, chronic) مع بعض
export const getMyProfile = async (req, res, next) => {
  try {
    const user = await db_service.findOne({
      model: usermodel,
      filter: { _id: req.user._id, role: roleenum.patient },
      select: "fullName email phoneNumber address profilepicture role",
    });

    if (!user) {
      throw new Error("patient not found", { cause: 404 });
    }

    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });

    const userData = user.toObject();

    // decrypt phone number
    if (userData.phoneNumber) {
      userData.phoneNumber = decrypt(userData.phoneNumber);
    }

    return successresponse({
      res,
      data: {
        // user fields
        fullName: userData.fullName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        address: userData.address,
        profilepicture: userData.profilepicture,
        // patient model fields
        dateOfBirth: patient?.dateOfBirth ?? null,
        age: patient?.calculatedAge ?? patient?.age ?? null,
        governorate: patient?.governorate ?? null,
        gender: patient?.gender ?? null,
        bloodType: patient?.bloodType ?? null,
        height: patient?.height ?? null,
        weight: patient?.weight ?? null,
        pulse: patient?.pulse ?? null,
        allergies: patient?.allergies ?? [],
        chronic: patient?.chronic ?? [],
        surgeries: patient?.surgeries ?? [],
        sharingSetting: patient?.sharingSetting ?? "all",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /patient/profile ───────────────────────────────────────────────────
// يحدّث user fields (fullName, phone, address) + patient fields (age, gender, bloodType, allergies, chronic)
export const updatePatientProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      phoneNumber,
      address,
      dateOfBirth,
      age,
      governorate,
      gender,
      bloodType,
      allergies,
      surgeries,
      chronic,
      height,
      weight,
      pulse,
      sharingSetting,
    } = req.body;

    // 1. Update user model
    const userUpdate = {};
    if (fullName !== undefined) userUpdate.fullName = fullName;
    if (address !== undefined) userUpdate.address = address;
    if (phoneNumber !== undefined) {
      const newPhoneHash = hashPhone(phoneNumber);
      
      // Check if another user already has this phone number
      const existingPhone = await db_service.findOne({
        model: usermodel,
        filter: { 
          phoneHash: newPhoneHash,
          _id: { $ne: req.user._id }
        },
      });

      if (existingPhone) {
        throw new Error("phone number already in use", { cause: 409 });
      }

      userUpdate.phoneNumber = encrypt(phoneNumber);
      userUpdate.phoneHash = newPhoneHash;
    }

    if (Object.keys(userUpdate).length > 0) {
      await db_service.findOneAndUpdate({
        model: usermodel,
        filter: { _id: req.user._id },
        update: userUpdate,
        options: { new: true },
      });
    }

    // 2. Update patient model
    const patientUpdate = {};
    if (dateOfBirth !== undefined) patientUpdate.dateOfBirth = dateOfBirth;
    if (age !== undefined) patientUpdate.age = age;
    if (governorate !== undefined) patientUpdate.governorate = governorate;
    if (gender !== undefined) patientUpdate.gender = gender;
    if (bloodType !== undefined) patientUpdate.bloodType = bloodType;
    if (allergies !== undefined) patientUpdate.allergies = allergies;
    if (chronic !== undefined) patientUpdate.chronic = chronic;
    if (surgeries !== undefined) patientUpdate.surgeries = surgeries;
    if (height !== undefined) patientUpdate.height = height;
    if (weight !== undefined) patientUpdate.weight = weight;
    if (pulse !== undefined) patientUpdate.pulse = pulse;
    if (sharingSetting !== undefined) patientUpdate.sharingSetting = sharingSetting;

    if (Object.keys(patientUpdate).length > 0) {
      await db_service.findOneAndUpdate({
        model: patientmodel,
        filter: { userId: req.user._id },
        update: patientUpdate,
        options: { new: true, upsert: true },
      });
    }

    return successresponse({
      res,
      message: "profile updated successfully",
      data: {
        fullName,
        phoneNumber, // return plain (not encrypted)
        address,
        age,
        gender,
        bloodType,
        allergies,
        chronic,
        surgeries,
        height,
        weight,
        pulse,
        sharingSetting,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /patient/profile-image ─────────────────────────────────────────────
export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error("image required", { cause: 400 });
    }

    // delete old image if exists
    if (req.user.profilepicture?.public_id) {
      await cloudinary.uploader.destroy(req.user.profilepicture.public_id);
    }

    const { secure_url, public_id } = await cloudinary.uploader.upload(
      req.file.path,
      {
        folder: "carehub/patient",
      },
    );

    const user = await db_service.findOneAndUpdate({
      model: usermodel,
      filter: { _id: req.user._id },
      update: { profilepicture: { secure_url, public_id } },
      options: { new: true },
    });

    return successresponse({
      res,
      message: "profile image uploaded successfully",
      data: { profilepicture: user.profilepicture },
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /patient/profile-image ────────────────────────────────────────────
export const deleteProfileImage = async (req, res, next) => {
  try {
    if (!req.user.profilepicture?.public_id) {
      throw new Error("image not found", { cause: 404 });
    }

    await cloudinary.uploader.destroy(req.user.profilepicture.public_id);

    await db_service.findOneAndUpdate({
      model: usermodel,
      filter: { _id: req.user._id },
      update: { profilepicture: null },
      options: { new: true },
    });

    return successresponse({
      res,
      message: "profile picture deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// ─── HEALTH TRACKING ─────────────────────────────────────────────────────────

export const addTrackingRecord = async (req, res, next) => {
  try {
    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });
    if (!patient) throw new Error("Patient not found", { cause: 404 });

    const newRecord = await healthtrackingmodel.create({
      patientId: patient._id,
      ...req.body
    });

    return successresponse({ res, message: "Tracking record added successfully", data: newRecord });
  } catch (error) {
    next(error);
  }
};

export const getTrackingRecords = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, getAll = "false" } = req.query;

    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });
    if (!patient) throw new Error("Patient not found", { cause: 404 });

    let filter = { patientId: patient._id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (getAll === "true") {
      const records = await healthtrackingmodel.find(filter).sort({ date: -1 });
      return successresponse({ res, data: records });
    }

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const [records, totalRecords] = await Promise.all([
      healthtrackingmodel.find(filter).sort({ date: -1 }).skip(skip).limit(pageSize),
      healthtrackingmodel.countDocuments(filter)
    ]);

    return successresponse({ 
      res, 
      data: records,
      pagination: {
        total: totalRecords,
        page: pageNumber,
        pages: Math.ceil(totalRecords / pageSize),
        limit: pageSize
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateTrackingRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });
    if (!patient) throw new Error("Patient not found", { cause: 404 });

    const record = await healthtrackingmodel.findOne({ _id: id, patientId: patient._id });
    if (!record) throw new Error("Tracking record not found", { cause: 404 });

    const updatedRecord = await db_service.findOneAndUpdate({
      model: healthtrackingmodel,
      filter: { _id: id, patientId: patient._id },
      update: req.body,
      options: { new: true }
    });

    return successresponse({ res, message: "Tracking record updated successfully", data: updatedRecord });
  } catch (error) {
    next(error);
  }
};

export const deleteTrackingRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });
    if (!patient) throw new Error("Patient not found", { cause: 404 });

    const record = await healthtrackingmodel.findOne({ _id: id, patientId: patient._id });
    if (!record) throw new Error("Tracking record not found", { cause: 404 });

    await db_service.deleteOne({
      model: healthtrackingmodel,
      filter: { _id: id, patientId: patient._id }
    });

    return successresponse({ res, message: "Tracking record deleted successfully" });
  } catch (error) {
    next(error);
  }
};
// ─── MEDICATION TRACKING ───────────────────────────────────────────────────────

// Helper to calculate and insert explicitly missed doses for past days
async function _syncMissedDoses(patientId) {
    const prescriptions = await db_service.find({
        model: prescriptionmodel,
        filter: { patientId } 
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    for (const rx of prescriptions) {
        const rxDate = new Date(rx.createdAt);
        rxDate.setHours(0, 0, 0, 0);
        
        for (const med of rx.medications) {
            const frequency = parseFrequency(med.frequency);
            const durationInfo = parseDuration(med.duration);
            let totalDays = durationInfo.days;
            
            let endDate = new Date(rxDate);
            if (!durationInfo.isLifelong) {
                endDate.setDate(endDate.getDate() + totalDays - 1); 
            } else {
                endDate = new Date(todayStart);
                endDate.setDate(endDate.getDate() - 1); 
            }
            
            let checkEndDate = new Date(todayStart);
            checkEndDate.setDate(checkEndDate.getDate() - 1); // Only check up to yesterday

            if (!durationInfo.isLifelong && endDate < checkEndDate) {
                checkEndDate = endDate;
            }

            if (rxDate > checkEndDate) {
                continue; // Prescription started today or in the future
            }

            const trackingRecords = await db_service.find({
                model: medicationtrackingmodel,
                filter: {
                    patientId,
                    medicationId: med._id,
                    scheduledDoseDateTime: { $gte: rxDate, $lte: new Date(checkEndDate.getTime() + 86399999) }
                }
            });

            const recordsByDay = {};
            for (const r of trackingRecords) {
                const dayStr = r.scheduledDoseDateTime.toISOString().split('T')[0];
                if (!recordsByDay[dayStr]) recordsByDay[dayStr] = 0;
                recordsByDay[dayStr]++;
            }

            let loopDate = new Date(rxDate);
            const recordsToInsert = [];
            while (loopDate <= checkEndDate) {
                const dayStr = loopDate.toISOString().split('T')[0];
                const count = recordsByDay[dayStr] || 0;
                
                if (count < frequency) {
                    const missedCount = frequency - count;
                    for (let i = 0; i < missedCount; i++) {
                        const missedDate = new Date(loopDate);
                        missedDate.setHours(12 + i, 0, 0, 0); // Arbitrary time
                        recordsToInsert.push({
                            patientId,
                            prescriptionId: rx._id,
                            medicationId: med._id,
                            scheduledDoseDateTime: missedDate,
                            status: 'missed',
                            completedAt: missedDate,
                            isAutoSynced: true
                        });
                    }
                }
                loopDate.setDate(loopDate.getDate() + 1);
            }

            if (recordsToInsert.length > 0) {
                await medicationtrackingmodel.insertMany(recordsToInsert, { ordered: false }).catch(err => {
                    // Ignore duplicate key errors silently
                    if (err.code !== 11000) {
                        console.error("Error inserting missed doses:", err);
                    }
                });
            }
        }
    }
}

// Helper to get all active medications from all prescriptions of the patient
async function _getActiveMedicationsList(patientId) {
    const prescriptions = await db_service.find({
        model: prescriptionmodel,
        filter: { patientId, status: "active" }
    });

    const activeMeds = [];
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todaysTracking = await db_service.find({
        model: medicationtrackingmodel,
        filter: {
            patientId,
            scheduledDoseDateTime: { $gte: todayStart, $lte: todayEnd },
            isAutoSynced: { $ne: true }  // Only show records the patient manually tracked
        }
    });
    const todaysTrackingCounts = {};
    for (const t of todaysTracking) {
        if (t.status === 'taken' || t.status === 'missed') {
            const key = t.medicationId.toString();
            todaysTrackingCounts[key] = (todaysTrackingCounts[key] || 0) + 1;
        }
    }

    const allTracking = await db_service.find({
        model: medicationtrackingmodel,
        filter: { patientId }
    });

    const takenCounts = {};
    for (const t of allTracking) {
        if (t.status === 'taken') {
            const key = t.medicationId.toString();
            takenCounts[key] = (takenCounts[key] || 0) + 1;
        }
    }

    for (const rx of prescriptions) {
        const rxDate = new Date(rx.createdAt);
        
        for (const med of rx.medications) {
            const durationInfo = parseDuration(med.duration);
            const frequency = parseFrequency(med.frequency);
            
            let isActive = false;
            let daysCompleted = 0;
            let daysRemaining = null;
            let totalDays = durationInfo.days;

            if (durationInfo.isLifelong) {
                isActive = true;
                const diffTime = Math.abs(now - rxDate);
                daysCompleted = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else {
                const endDate = new Date(rxDate);
                endDate.setDate(endDate.getDate() + totalDays);
                
                if (now <= endDate) {
                    isActive = true;
                    const diffTime = Math.abs(now - rxDate);
                    daysCompleted = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    daysRemaining = totalDays - daysCompleted;
                } else if (now > endDate && (now - endDate) < 24 * 60 * 60 * 1000) {
                    // Just finished today
                    isActive = true;
                    daysCompleted = totalDays;
                    daysRemaining = 0;
                }
            }

            if (isActive) {
                // Calculate progress % based on doses taken vs doses expected
                let progress = 0;
                let totalTaken = takenCounts[med._id.toString()] || 0;

                if (durationInfo.isLifelong) {
                    const expectedSoFar = (daysCompleted + 1) * frequency;
                    progress = expectedSoFar > 0 ? Math.min(100, Math.floor((totalTaken / expectedSoFar) * 100)) : 0;
                } else if (totalDays > 0) {
                    const totalExpected = totalDays * frequency;
                    progress = totalExpected > 0 ? Math.min(100, Math.floor((totalTaken / totalExpected) * 100)) : 0;
                }

                const trackedToday = todaysTrackingCounts[med._id.toString()] || 0;
                const hasTrackedToday = trackedToday >= frequency;

                const todaysRecords = todaysTracking.filter(t => t.medicationId.toString() === med._id.toString());

                activeMeds.push({
                    prescriptionId: rx._id,
                    medicationId: med._id,
                    medicineName: med.medicineName,
                    dosage: med.dosage,
                    frequency: med.frequency,
                    frequencyPerDay: frequency,
                    duration: med.duration,
                    startDate: rxDate,
                    endDate: durationInfo.isLifelong ? null : new Date(rxDate.getTime() + totalDays * 24 * 60 * 60 * 1000),
                    isLifelong: durationInfo.isLifelong,
                    daysCompleted,
                    daysRemaining,
                    progress,
                    hasTrackedToday,
                    todaysRecords
                });
            }
        }
    }
    return activeMeds;
}

export async function _syncMissedDosesForAll() {
    const allPatients = await patientmodel.find({}).select("userId").lean();
    for (const patient of allPatients) {
        if (!patient.userId) continue;
        try {
            await _syncMissedDoses(patient.userId);
        } catch (err) {
            console.error(`Failed to sync missed doses for patient ${patient.userId}:`, err);
        }
    }
}

export const getActiveMedications = async (req, res, next) => {
    try {
        const activeMeds = await _getActiveMedicationsList(req.user._id);
        return successresponse({ res, data: activeMeds });
    } catch (error) {
        next(error);
    }
};

export const getMedicationHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 5, filter = 'all' } = req.query;
        
        let queryFilter = { patientId: req.user._id };
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        if (filter === 'today') {
            queryFilter.scheduledDoseDateTime = { $gte: todayStart };
        } else if (filter === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - 7);
            queryFilter.scheduledDoseDateTime = { $gte: weekStart };
        } else if (filter === 'month') {
            const monthStart = new Date(now);
            monthStart.setMonth(monthStart.getMonth() - 1);
            queryFilter.scheduledDoseDateTime = { $gte: monthStart };
        }

        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const skip = (pageNumber - 1) * pageSize;

        const [history, totalRecords] = await Promise.all([
            medicationtrackingmodel.find(queryFilter).sort({ scheduledDoseDateTime: -1 }).skip(skip).limit(pageSize),
            medicationtrackingmodel.countDocuments(queryFilter)
        ]);

        return successresponse({ 
            res, 
            data: history,
            pagination: {
                total: totalRecords,
                page: pageNumber,
                pages: Math.ceil(totalRecords / pageSize),
                limit: pageSize
            }
        });
    } catch (error) {
        next(error);
    }
};

export const trackMedicationDose = async (req, res, next) => {
    try {
        const { prescriptionId, medicationId, scheduledDoseDateTime, status } = req.body;
        
        if (!['taken', 'missed'].includes(status)) {
            throw new Error("Invalid status", { cause: 400 });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const prescription = await db_service.findOne({
            model: prescriptionmodel,
            filter: { _id: prescriptionId, patientId: req.user._id }
        });

        if (!prescription) {
            throw new Error("Prescription not found", { cause: 404 });
        }

        const medication = prescription.medications.find(m => m._id.toString() === medicationId);
        if (!medication) {
            throw new Error("Medication not found", { cause: 404 });
        }

        const frequency = parseFrequency(medication.frequency);

        const existingRecordsCount = await db_service.count({
            model: medicationtrackingmodel,
            filter: {
                patientId: req.user._id,
                medicationId,
                scheduledDoseDateTime: { $gte: todayStart, $lte: todayEnd },
                isAutoSynced: { $ne: true }
            }
        });

        if (existingRecordsCount >= frequency) {
            return next(new Error("You have already tracked all scheduled doses for this medication today", { cause: 400 }));
        }

        const record = await medicationtrackingmodel.create({
            patientId: req.user._id, 
            prescriptionId, 
            medicationId, 
            scheduledDoseDateTime: new Date(scheduledDoseDateTime), 
            status, 
            completedAt: new Date()
        });

        return successresponse({ res, message: "Dose tracked successfully", data: record });
    } catch (error) {
        if (error.code === 11000) {
            return next(new Error("This dose has already been tracked", { cause: 400 }));
        }
        next(error);
    }
};

export const untrackMedicationDose = async (req, res, next) => {
    try {
        const { recordId } = req.params;

        const record = await medicationtrackingmodel.findOneAndDelete({
            _id: recordId,
            patientId: req.user._id,
            isAutoSynced: { $ne: true }  // Prevent deleting auto-synced records
        });

        if (!record) {
            return next(new Error("Tracking record not found or cannot be undone", { cause: 404 }));
        }

        return successresponse({ res, message: "Dose untracked successfully", data: record });
    } catch (error) {
        next(error);
    }
};

export const updateMedicationDose = async (req, res, next) => {
    try {
        const { recordId } = req.params;
        const { status, scheduledDoseDateTime } = req.body;
        
        if (!['taken', 'missed'].includes(status)) {
            throw new Error("Invalid status", { cause: 400 });
        }

        const updateData = { status };
        if (scheduledDoseDateTime) {
            updateData.scheduledDoseDateTime = new Date(scheduledDoseDateTime);
        }

        const record = await medicationtrackingmodel.findOneAndUpdate(
            { _id: recordId, patientId: req.user._id },
            updateData,
            { new: true }
        );
        
        if (!record) {
            throw new Error("Tracking record not found", { cause: 404 });
        }
        
        return successresponse({ res, message: "Dose updated successfully", data: record });
    } catch (error) {
        next(error);
    }
};

export const getMedicationSummary = async (req, res, next) => {
    try {
        const activeMeds = await _getActiveMedicationsList(req.user._id);
        
        const trackingRecords = await db_service.find({
            model: medicationtrackingmodel,
            filter: { patientId: req.user._id, isAutoSynced: { $ne: true } },
            options: { sort: { scheduledDoseDateTime: -1 } }
        });

        let totalTaken = 0;
        let totalMissed = 0;
        
        trackingRecords.forEach(r => {
            if (r.status === 'taken') totalTaken++;
            else if (r.status === 'missed') totalMissed++;
        });

        const totalExpected = totalTaken + totalMissed;
        let adherencePercentage = 0;
        if (totalExpected > 0) {
            adherencePercentage = Math.round((totalTaken / totalExpected) * 100);
        }

        let totalProgressSum = 0;
        let activeMedCount = activeMeds.length;
        activeMeds.forEach(m => totalProgressSum += m.progress);
        const overallProgress = activeMedCount > 0 ? Math.round(totalProgressSum / activeMedCount) : 0;

        let currentStreak = 0;
        const recordsByDay = {};
        trackingRecords.forEach(r => {
            const d = r.scheduledDoseDateTime;
            const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!recordsByDay[dayStr]) recordsByDay[dayStr] = { taken: 0, missed: 0 };
            if (r.status === 'taken') recordsByDay[dayStr].taken++;
            else if (r.status === 'missed') recordsByDay[dayStr].missed++;
        });

        const sortedDays = Object.keys(recordsByDay).sort((a, b) => new Date(b) - new Date(a));
        
        for (const day of sortedDays) {
            if (recordsByDay[day].missed > 0) {
                break; // Streak broken
            }
            if (recordsByDay[day].taken > 0) {
                currentStreak++;
            }
        }

        return successresponse({ res, data: {
            activeMedicationsCount: activeMedCount,
            overallProgress,
            adherencePercentage,
            totalTaken,
            totalMissed,
            currentStreak
        }});
    } catch (error) {
        next(error);
    }
};

export const setMedicationSchedule = async (req, res, next) => {
    try {
        const { prescriptionId, medicationId, medicineName, scheduleType, times, intervalData } = req.body;
        
        // Find existing schedule or create new one
        const schedule = await db_service.findOneAndUpdate({
            model: medicationschedulemodel,
            filter: { patientId: req.user._id, medicationId },
            update: {
                prescriptionId,
                medicineName,
                scheduleType,
                times: times || [],
                intervalData: intervalData || { hours: 0, startTime: "" },
                isActive: true
            },
            options: { upsert: true, new: true }
        });

        return successresponse({ res, message: "Medication schedule updated successfully", data: schedule });
    } catch (error) {
        next(error);
    }
};

export const getMedicationSchedules = async (req, res, next) => {
    try {
        const schedules = await db_service.find({
            model: medicationschedulemodel,
            filter: { patientId: req.user._id, isActive: true }
        });

        return successresponse({ res, data: schedules });
    } catch (error) {
        next(error);
    }
};