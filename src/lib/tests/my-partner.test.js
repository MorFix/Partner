import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import {login, getTvContractsData} from '../my-partner';
import {VALID_ID, VALID_DIGITS, VALID_USER_TOKEN} from './constants';

const mockAxios = new MockAdapter(axios);

const mockServerLogin = () => {
    return [200, {}];
};

const mockServerTvContracts = () => {
    return [200, {}];
};

beforeEach(() => {
    // TODO: set the real URLs here
    mockAxios.onPost(/login/).reply(mockServerLogin);
    mockAxios.onPost(/tv/).reply(mockServerTvContracts);
});

afterEach(() => {
    mockAxios.reset();
});

describe('My Partner login', () => {
    test('login with valid credentials', async done => {
        done();
    });
});

describe('get Partner TV contracts for account', () => {
    test('get contracts with valid auth key', async done => {
        done();
    });
});
