
export const create = async ({ model, data } = {}) => {
    return await model.create(data);
};

export const findOne = async ({ model, filter = {}, options = {} } = {}) => {
    let query = model.findOne(filter);

    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);

    return await query.exec();
};

export const find = async ({ model, filter = {}, options = {} } = {}) => {
    let query = model.find(filter);

    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);
    if (options.skip) query = query.skip(options.skip);
    if (options.limit) query = query.limit(options.limit);
    if (options.sort) query = query.sort(options.sort);

    return await query.exec();
};

export const updateOne = async ({ model, filter = {}, update = {}, options = {} } = {}) => {
    return await model.updateOne(filter, update, {
        runValidators: true,
        ...options
    });
};

export const findOneAndUpdate = async ({ model, filter = {}, update = {}, options = {} } = {}) => {
    return await model.findOneAndUpdate(filter, update, {
        new: true,
        runValidators: true,
        ...options
    });
};

export const deleteOne = async ({ model, filter = {} } = {}) => {
    return await model.deleteOne(filter);
};
export const deleteMany = async ({ model, filter = {} } = {}) => {
    return await model.deleteMany(filter);
};
export const count = async ({ model, filter = {} } = {}) => {
    return await model.countDocuments(filter);
};
export const findById = async ({ model, id, options = {} } = {}) => {

    let query = model.findById(id);

    if (options.select) {
        query = query.select(options.select);
    }

    if (options.populate) {
        query = query.populate(options.populate);
    }

    return  query.exec();
};