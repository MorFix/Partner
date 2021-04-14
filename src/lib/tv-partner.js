import soap from 'soap';
import xml from 'xml';
import axios from 'axios';

const REDMI_DEVICE = {
    DeviceName: 'Redmi Note 4',
    DeviceNickName: 'Redmi-Mor',
    DeviceOs: 'Android',
    DeviceOperator: null,
    DeviceSecureId: 'ac99c599b79069a0'
};

const ONEPLUS_DEVICE = {
    DeviceName: 'AC2003',
    DeviceNickName: 'OnePlus Nord',
    DeviceOs: 'Android',
    DeviceOperator: null,
    DeviceSecureId: 'bfa202aae61f7d68'
};

export const login = async (email, password) => {
    const ACTION_NAME = 'CheckSubsAuthAndCreateToken';
    const soapUrl = 'https://plush.partner.co.il/TVInformation.svc?wsdl';

    const loginSoapClient = await soap.createClientAsync(soapUrl);

    const loginData = {
        Password: password,
        TokenType: 'HOURS24',
        TvDevice: {
            ClientMsisdn: null,
            ...ONEPLUS_DEVICE,
            DeviceSerial: null,
            DeviceType: 'SMARTPHONE'
        },
        UserName: email,
    };

    const [loginResponse] = await loginSoapClient[`${ACTION_NAME}Async`]({ request: loginData });

    const { Msisdn: userId, Token: token, responseStatus } = loginResponse[`${ACTION_NAME}Result`];
    if (responseStatus.status === 'ERROR') {
        const error = new Error('Login Error');
        error.additionalData = { userId, code: responseStatus.statusCode, message: responseStatus.statusMessage };

        throw error;
    }

    return { userId, token };
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

export const createSession = async (channelId, { userId, token }) => {
    const creationData = {
        CreateSession: [
            { ChannelId: channelId }
        ]
    };

    const config = {
        method: 'POST',
        url: `https://pub.partner.co.il/traxis/web/Session/propset/all?CustomerId=${userId}&SeacToken=${token}&SeacClass=personal&Output=json`,
        data: creationData,
        headers: {
            'User-Agent': 'iFeelSmart-Android_MOBILE_AVC_L3',
        }
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