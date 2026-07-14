import multer from "multer"
import fs from "node:fs"


export const multer_host = (custom_types = []) => {

    const storage = multer.diskStorage({});

    const fileFilter = (req, file, cb) => {
        if (!custom_types.includes(file.mimetype)) {
            return cb(new Error("invalid file type"), false);
        }
        cb(null, true);
    };

    const upload= multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024}
    });
    return upload
};

