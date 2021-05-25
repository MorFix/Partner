import axiosLib from 'axios';

const axios = axiosLib.create({baseURL: 'https://my.partner.co.il'});

const CONTRACT_TYPES = {
    CELLULAR: 1,
    TV: 2
};

const createPartnerRequestConfig = ({url, method = 'POST', data, headers = {}}, userAuth) => ({
    url,
    method,
    data,
    headers: {
        category: 'MyPartnerApp',
        appName: 'MyPartnerApp',
        subCategory: 'PersonalArea',
        platform: 'MOBILE_WEB',
        brand: 'orange',
        ...(userAuth ? {AuthKey: userAuth} : {}),
        ...headers
    }
});

const getPartnerResponse = async request => {
    try { // 2XX status code, but maybe a logical error
        const {data: result} = await axios.request(request);

        if (!result.isSuccess) {
            throw new Error(result.statusMsg)
        }

        return result.data;
    } catch (err) { // request error or bad status code
        if (err.response?.data?.Message) {
            throw new Error(err.response.data.Message);
        }

        throw err;
    }
};

export const login = async (idNumber, lastDigits) => {
    const request = createPartnerRequestConfig({url: '/LoginAPI/AuthConsumer/LoginByPayments', data: {idNumber, lastDigits}});

    const {authKey} = await getPartnerResponse(request);

    return authKey.authKey;
};

const getTvContractAuthKeys = async authKey => {
    const data = {keyType: 2, contractTypeList: [CONTRACT_TYPES.TV], getSuspendedContracts: true};
    const request = createPartnerRequestConfig({url: '/LoginAPI/Consumer/GetConsumer', data}, authKey);

    const {customers} = await getPartnerResponse(request);

    if (!customers.length) {
        throw new Error('Cannot find TV contract. Please make sure you are registered to the service');
    }

    return customers.flatMap(({contracts}) => contracts.map(x => x.authKey));
};

const getTvSingleContract = async (userAuth, tvContractAuth) => {
    const data = {auth: tvContractAuth};
    const request = createPartnerRequestConfig({url: '/PersonalAreaAPI/api/Tv/GetTvContractData', data}, userAuth);

    const {data: {userName, devices}} = await axios.request(request);

    return {userName, devices};
};

export const getTvContractsData = async userAuth => {
    const tvAuthKeys = await getTvContractAuthKeys(userAuth);

    return await Promise.all(tvAuthKeys.map(tvKey => getTvSingleContract(userAuth, tvKey)));
}

