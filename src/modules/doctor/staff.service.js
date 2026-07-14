import { AssistantModel } from "../../DB/models/assistant_model.js";
import { ActionLogModel } from "../../DB/models/action_log_model.js";
import usermodel from "../../DB/models/usermodel.js";
import { roleenum } from "../../common/enum/user.enum.js";
import bcrypt from "bcrypt";

export const createStaff = async (req, res, next) => {
    try {
        const { fullName, email, password, phoneNumber, clinicId, jobTitle, permissions } = req.body;

        // Ensure current user is doctor
        if (req.user.role !== roleenum.doctor) {
            return res.status(403).json({ message: "Only doctors can manage staff." });
        }

        // Check if user email already exists
        const existingUser = await usermodel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use." });
        }

        // Create the user account with role 'assistant'
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await usermodel.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
            role: roleenum.assistant,
            confirmed: true
        });

        // Create the assistant record
        const newAssistant = await AssistantModel.create({
            userId: newUser._id,
            doctorId: req.user._id,
            clinicId,
            jobTitle: jobTitle || "Secretary",
            permissions: permissions || {}
        });

        // Populate the response for immediate frontend display
        await newAssistant.populate([
            { path: "userId", select: "fullName email phoneNumber profilepicture" },
            { path: "clinicId", select: "name" }
        ]);

        res.status(201).json({ message: "Staff member created successfully", data: newAssistant });
    } catch (error) {
        console.error(error);
        
        // Handle Mongoose validation errors
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(", ") });
        }
        
        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = error.keyValue ? Object.keys(error.keyValue)[0] : "A field";
            return res.status(400).json({ message: `${field} is already in use.` });
        }
        
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getStaff = async (req, res, next) => {
    try {
        const filter = { doctorId: req.user._id };
        if (req.query.clinicId && req.query.clinicId !== "all") {
            filter.clinicId = req.query.clinicId;
        }

        const assistants = await AssistantModel.find(filter)
            .populate("userId", "fullName email phoneNumber profilepicture")
            .populate("clinicId", "name");
        res.status(200).json({ data: assistants });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const updateStaff = async (req, res, next) => {
    try {
        const { id } = req.params; // assistant document ID
        const { jobTitle, clinicId, permissions, isActive, password, fullName, phoneNumber } = req.body;

        const assistant = await AssistantModel.findOne({ _id: id, doctorId: req.user._id });
        if (!assistant) return res.status(404).json({ message: "Staff not found" });

        // Update Assistant specific fields
        if (jobTitle !== undefined) assistant.jobTitle = jobTitle;
        if (clinicId !== undefined) assistant.clinicId = clinicId;
        if (permissions !== undefined) assistant.permissions = permissions;
        if (isActive !== undefined) assistant.isActive = isActive;
        await assistant.save();

        // Update User specific fields
        const userUpdate = {};
        if (fullName) userUpdate.fullName = fullName;
        if (phoneNumber) userUpdate.phoneNumber = phoneNumber;
        if (password) {
            userUpdate.password = await bcrypt.hash(password, 10);
        }
        
        if (Object.keys(userUpdate).length > 0) {
            await usermodel.findByIdAndUpdate(assistant.userId, userUpdate);
        }

        await assistant.populate([
            { path: "userId", select: "fullName email phoneNumber profilepicture" },
            { path: "clinicId", select: "name" }
        ]);

        res.status(200).json({ message: "Staff updated successfully", data: assistant });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const deleteStaff = async (req, res, next) => {
    try {
        const { id } = req.params;
        const assistant = await AssistantModel.findOneAndDelete({ _id: id, doctorId: req.user._id });
        if (!assistant) return res.status(404).json({ message: "Staff not found" });

        // Also delete the user
        await usermodel.findByIdAndDelete(assistant.userId);
        
        res.status(200).json({ message: "Staff deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getLogs = async (req, res, next) => {
    try {
        const { limit = 50, page = 1, assistantId } = req.query;
        const query = { doctorId: req.user._id };
        if (assistantId) query.assistantId = assistantId;

        const logs = await ActionLogModel.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate({ path: "assistantId", select: "fullName" });

        const total = await ActionLogModel.countDocuments(query);

        res.status(200).json({
            data: logs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
