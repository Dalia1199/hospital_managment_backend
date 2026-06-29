 export const getDateFilter = (period = "month") => {

    const now = new Date();

    let startDate = new Date();

    switch (period) {

        case "today":

            startDate.setHours(0, 0, 0, 0);

            break;

        case "week":

            startDate.setDate(now.getDate() - 7);

            break;

        case "year":

            startDate.setFullYear(now.getFullYear() - 1);

            break;

        default:

            startDate.setMonth(now.getMonth() - 1);

    }

    return {

        createdAt: {

            $gte: startDate,

            $lte: now

        }

    };

};
 export const getNextSevenDays = () => {

    const today = new Date();

    const nextWeek = new Date();

    nextWeek.setDate(today.getDate() + 7);

    return {

        today,

        nextWeek

    };

};