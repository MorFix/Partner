const actions = [];

export const reset = () => {
    actions.length = 0;
};

export const addAction = (name, action) => {
    actions.push({name, action});
};

const createClientAsync = () => {
    const client = actions.reduce((all, {name, action}) => {
        all[`${name}Async`] = (...args) => Promise.resolve([
            {
                [`${name}Result`]: action(...args)
            }
        ]);

        return all;
    }, {});

    return Promise.resolve(client);
};

export default {createClientAsync};