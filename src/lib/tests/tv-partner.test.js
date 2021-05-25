import axios from 'axios';
import {parseStringPromise} from 'xml2js';

import MockAdapter from 'axios-mock-adapter';
import {reset as resetSoap, addAction} from 'soap';

import {VALID_ID, VALID_DIGITS, VALID_PASSWORD, VALID_USER_ID, VALID_TV_TOKEN} from './constants';

import {login, createSessions, createSessionsForce} from '../tv-partner';

jest.mock('soap');
jest.mock('../my-partner.js');

describe('tests the login functionality', () => {
    const INVALID_PASSWORD_MESSAGE = 'Invalid password';

    beforeEach(() => {
        addAction('CheckSubsAuthAndCreateToken', ({request: {Password}}) => {
            if (Password !== VALID_PASSWORD) {
                return {
                    Msisdn: VALID_USER_ID,
                    Token: '',
                    responseStatus: {status: 'ERROR', statusMessage: INVALID_PASSWORD_MESSAGE, statusCode: '2'}
                };
            }

            return {
                Msisdn: VALID_USER_ID,
                Token: VALID_TV_TOKEN,
                responseStatus: {status: 'SUCCESS', statusMessage: '', statusCode: ''}
            };
        });
    });

    afterEach(() => {
        resetSoap();
    });

    test('login with the correct credentials', async done => {
        const response = await login(VALID_ID, VALID_DIGITS, VALID_PASSWORD);

        expect(response.userId).toBe(VALID_USER_ID);

        done();
    });

    test('login with incorrect partner credentials', async done => {
        try {
            await login('123456789', '121212', '5555');
        } catch (err) {
            expect(err.message).toBe('Invalid partner credentials');
        }

        done();
    });

    test('login with correct partner credentials but incorrect password', async done => {
        try {
            await login(VALID_ID, VALID_DIGITS, '5555');
        } catch (err) {
            expect(err.message).toBe(INVALID_PASSWORD_MESSAGE);
        }

        done();
    });
});

describe('create sessions', () => {
    const mockAxios = new MockAdapter(axios);

    const FREE_CHANNEL_MOCK = '1101';
    const PREMIUM_CHANNELS_MOCK = ['1184', '1186', '1188', '1242', '1250', '1461', '1464', '1467', '1470'];
    const PREMIUM_USER = '1240';

    const invalidTokenMessage = 'Invalid TV token';
    const premiumChannelMessage = 'Premium channel';

    const mockSessionsServer = async config => {
        if (config.params.SeacToken !== VALID_TV_TOKEN) {
            return [401, {Error: {Message: invalidTokenMessage}}];
        }

        const mode = config.headers?.['User-Agent']?.includes('Android') ? 'Mobile' : 'TV';
        const [channel] = (await parseStringPromise(config.data)).CreateSession.ChannelId;

        if (PREMIUM_CHANNELS_MOCK.includes(channel) && config.params.CustomerId !== PREMIUM_USER) {
            return [401, {Error: {Message: premiumChannelMessage}}];
        }

        return [200, {Session: {Playlist: {Channel: {Value: `${mode}_${channel}`}}}}];
    };

    const expectSuccess = (sessions, channel) => {
        expect(sessions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({dashUrl: `Mobile_${channel}`}),
                expect.objectContaining({dashUrl: `TV_${channel}`}),
            ])
        );
    };

    beforeEach(() => {
        mockAxios.onPost(/traxis/).reply(mockSessionsServer);
    });

    afterEach(() => {
        mockAxios.reset();
    });

    test('free channel, gracefully, valid token', async done => {
        const sessions = await createSessions(FREE_CHANNEL_MOCK, {userId: VALID_USER_ID, token: VALID_TV_TOKEN});

        expectSuccess(sessions, FREE_CHANNEL_MOCK);

        done();
    });

    test('free channel, gracefully, invalid token', async done => {
        try {
            await createSessions(FREE_CHANNEL_MOCK, { userId: VALID_USER_ID, token: '1234' });
        } catch (err) {
            expect(err.message).toEqual(invalidTokenMessage);
        }

        done();
    });

    test('premium channel, gracefully, free user', async done => {
        try {
            await createSessions(PREMIUM_CHANNELS_MOCK[0], { userId: VALID_USER_ID, token: VALID_TV_TOKEN });
        } catch (err) {
            expect(err.message).toEqual(premiumChannelMessage);
        }

        done();
    });

    test('premium channel, gracefully, premium user', async done => {
        const sessions = await createSessions(PREMIUM_CHANNELS_MOCK[0], { userId: PREMIUM_USER, token: VALID_TV_TOKEN });

        expectSuccess(sessions, PREMIUM_CHANNELS_MOCK[0]);

        done();
    });

    test('premium channel, brute force, free user, 50 tries', async done => {
        process.env.BRUTE_FORCE_TRIES = '50';

        const sessions = await createSessionsForce(PREMIUM_CHANNELS_MOCK[0], { userId: VALID_USER_ID, token: VALID_TV_TOKEN });

        expectSuccess(sessions, PREMIUM_CHANNELS_MOCK[0]);

        done();
    });

    test('premium channel, brute force, free user, 2 tries', async () => {
        expect.assertions(1);

        process.env.BRUTE_FORCE_TRIES = '2';

        const sessions = await createSessionsForce(PREMIUM_CHANNELS_MOCK[0], { userId: VALID_USER_ID, token: VALID_TV_TOKEN });

        expect(sessions.length).toBe(0);
    });
});
