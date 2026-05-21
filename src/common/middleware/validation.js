export const validation = (schema) => {
    return async (req, res, next) => {
        let errorresult = []
        for (const key of Object.keys(schema)) {
            const { error } = schema[key].validate(req[key], { abortEarly: false })
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
            return res.status(400).json({ messaage: "validation error", error: errorresult })
        }
        next()
    }

}
