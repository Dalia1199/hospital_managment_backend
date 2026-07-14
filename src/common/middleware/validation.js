import fs from 'fs';
export const validation = (schema) => {
    return async (req, res, next) => {
        let errorresult = []
        for (const key of Object.keys(schema)) {
            const { error } = schema[key].validate(req[key], { abortEarly: false, stripUnknown:true })
            if (error) {
                error.details.forEach(element => {
                    errorresult.push({
                        key,
                        path: element.path[0],
                        message: element.message
                    })

                });
            }
        }
        if (errorresult.length) {
            console.error("VALIDATION ERROR CAUGHT:", JSON.stringify(errorresult, null, 2));
            try { fs.writeFileSync('validation_error.log', JSON.stringify({ url: req.originalUrl, body: req.body, query: req.query, params: req.params, errorresult }, null, 2)); } catch(e){}
            return res.status(400).json({ message: "validation error", error: errorresult })
        }
        next()
    }

}
