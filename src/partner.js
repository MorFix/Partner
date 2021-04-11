import soap from 'soap';
import xml from 'xml';
import axios from 'axios';

// TODO: Fetch devices from https://my.partner.co.il/PersonalAreaAPI/api/Tv/GetTvContractData
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

export const login = (email, password) => {
    const ACTION_NAME = 'CheckSubsAuthAndCreateToken';
    const soapUrl = 'https://plush.partner.co.il/TVInformation.svc?wsdl';

    return soap.createClientAsync(soapUrl)
        .then(loginSoapClient => {
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

            return loginSoapClient[`${ACTION_NAME}Async`]({ request: loginData });
        })
        .then(([loginResponse]) => {
            const { Msisdn: userId, Token: token, responseStatus } = loginResponse[`${ACTION_NAME}Result`];
            if (responseStatus.status === 'ERROR') {
                return Promise.reject({ userId, code: responseStatus.statusCode, message: responseStatus.statusMessage });
            }

            return { userId, token };
        });
}

const generateTokenHeader = token => ({ Authorization: `SeacToken token="${token}"` });

const xmlRequest = (token, config) => axios.request({
    ...config,
    headers: { ...generateTokenHeader(token), 'Content-Type': 'text/xml', ...(config.headers || {}) },
    data: xml(config.data)
});

export const getChannels = ({ userId, token }) => {
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

    return xmlRequest(token, config)
        .then(({ data: { Channels: { Channel = [] } = {} } = {} }) =>
            Channel.map(x => {
                const logoPicture = x.Pictures.Picture.find(y => y.type === 'Logo');
                const logo = logoPicture && logoPicture.Value || null;

                return { id: x.id, name: x.Name, logo };
            }));
};

export const createSession = (channelId, {userId, token}) => {
    const creationData = {
        CreateSession: [
            {ChannelId: channelId}
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

    const drm = `/WV/Proxy/DRM?AssetId=${channelId}&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false`;

    return xmlRequest(token, config)
        .then(response => ({
            dashUrl: response.data.Session.Playlist.Channel.Value,
            drm
        }))
        .catch(error => Promise.reject(error.response.data.Error.Message));
};