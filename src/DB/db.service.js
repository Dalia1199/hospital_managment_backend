export const create = async ({ model, data } = {}) => {
    return await model.create(data);
};

export const findOne = async ({ model, filter = {}, options = {}, populate, select, lean } = {}) => {
    let query = model.findOne(filter);

    const _populate = populate || options.populate;
    const _select = select || options.select;
    const _lean = lean !== undefined ? lean : options.lean;

    if (_populate) query = query.populate(_populate);
    if (_select) query = query.select(_select);
    if (_lean) query = query.lean();

    return await query.exec();
};

export const find = async ({ model, filter = {}, options = {}, populate, select, skip, limit, sort, lean } = {}) => {
    let query = model.find(filter);

    const _populate = populate || options.populate;
    const _select = select || options.select;
    const _skip = skip || options.skip;
    const _limit = limit || options.limit;
    const _sort = sort || options.sort;
    const _lean = lean !== undefined ? lean : options.lean;

    if (_populate) query = query.populate(_populate);
    if (_select) query = query.select(_select);
    if (_skip) query = query.skip(_skip);
    if (_limit) query = query.limit(_limit);
    if (_sort) query = query.sort(_sort);
    if (_lean) query = query.lean();

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
export const findById = async ({ model, id, options = {}, select, populate, lean } = {}) => {

    let query = model.findById(id);

    const _populate = populate || options.populate;
    const _select = select || options.select;
    const _lean = lean !== undefined ? lean : options.lean;

    if (_select) query = query.select(_select);
    if (_populate) query = query.populate(_populate);
    if (_lean) query = query.lean();

    return  query.exec();
};
export const paginate = async ({
    model,
    filter = {},
    populate,
    select,
    sort,
    page = 1,
    limit = 10,
    lean = true
} = {}) => {

    const skip = (page - 1) * limit;

    const data = await find({

        model,

        filter,

        populate,

        select,

        sort,

        skip,

        limit,

        lean

    });

    const totalItems = await count({

        model,

        filter

    });

    return {

        data,

        pagination: {

            currentPage: page,

            totalPages: Math.ceil(totalItems / limit),

            totalItems,

            limit

        }

    };

};