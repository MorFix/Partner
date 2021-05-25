import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import {VALID_ID, VALID_DIGITS, VALID_USER_TOKEN, VALID_TV_TOKEN, VALID_USERNAME} from './constants';

const mockAxios = new MockAdapter(axios);

const {login, getTvContractsData} = require('../my-partner');

const createResponse = (data, statusMsg = '') => ({
    isSuccess: !statusMsg,
    statusMsg,
    data
});

const createErrorResponse = message => ({Message: message});

const INVALID_ID_MESSAGE = 'Invalid Id';
const INVALID_DIGITS_MESSAGE = 'Invalid Last digits';
const INVALID_TOKEN_MESSAGE = 'Invalid User token';

const mockServerLogin = config => {
    const body = JSON.parse(config.data);

    if (body.idNumber !== VALID_ID) {
        return [401, createErrorResponse(INVALID_ID_MESSAGE)];
    }

    if (body.lastDigits !== VALID_DIGITS) {
        return [401, createErrorResponse(INVALID_DIGITS_MESSAGE)];
    }

    return [200, createResponse({authKey: {authKey: VALID_USER_TOKEN}})];
};

const requestHasValidUserToken = ({headers}) => headers.AuthKey === VALID_USER_TOKEN;

const mockServerCustomer = config => {
    if (!requestHasValidUserToken(config)) {
        return [401, createErrorResponse(INVALID_TOKEN_MESSAGE)];
    }

    return [200, createResponse({customers: [{contracts: [{authKey: VALID_TV_TOKEN}]}]})];
};

const mockServerTvContract = config => {
    if (!requestHasValidUserToken(config)) {
        return [401, createErrorResponse(INVALID_TOKEN_MESSAGE)];
    }

    return [200, {userName: VALID_USERNAME, devices: []}];
};

beforeEach(() => {
    mockAxios.onPost(/LoginByPayments/).reply(mockServerLogin);
    mockAxios.onPost(/GetConsumer/).reply(mockServerCustomer);
    mockAxios.onPost(/GetTvContractData/).reply(mockServerTvContract);
});

afterEach(() => {
    mockAxios.reset();
});

describe('My Partner login', () => {
    test('login with valid credentials', async done => {
        const authKey = await login(VALID_ID, VALID_DIGITS);

        expect(authKey).toBe(VALID_USER_TOKEN);

        done();
    });

    test('login with invalid user id', async done => {
        try {
            await login('1234', VALID_DIGITS);
        } catch (err) {
            expect(err.message).toBe(INVALID_ID_MESSAGE);
        }

        done();
    });

    test('login with valid user id but wrong digits', async done => {
        try {
            await login(VALID_ID, '12346');
        } catch (err) {
            expect(err.message).toBe(INVALID_DIGITS_MESSAGE);
        }

        done();
    });

    // TODO: Unsuccessful 200 response
});

describe('get Partner TV contracts for account', () => {
    test('get contracts with valid auth key', async done => {
        // TODO: Implement

        done();
    });

    // TODO: User with no contracts
    // TODO: Unsuccessful 200 response
});
