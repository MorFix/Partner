import {VALID_ID, VALID_DIGITS, VALID_USERNAME, VALID_USER_TOKEN, VALID_TV_TOKEN} from '../../../tests/constants';

export const login = (idNumber, lastDigits) => idNumber === VALID_ID && lastDigits === VALID_DIGITS
    ? Promise.resolve(VALID_USER_TOKEN)
    : Promise.reject(new Error('Invalid partner credentials'));

export const getTvContractAuthKeys = authKey => authKey === VALID_USER_TOKEN
    ? Promise.resolve([VALID_TV_TOKEN])
    : Promise.reject(new Error('Invalid token'));

export const getTvContractsData = (userAuth, tvContractKeys) => userAuth === VALID_USER_TOKEN && tvContractKeys.includes(VALID_TV_TOKEN)
    ? Promise.resolve([{userName: VALID_USERNAME, devices: [{}]}])
    : Promise.reject(new Error('Invalid partner/tv tokens'));