import {VALID_ID, VALID_DIGITS, VALID_USERNAME, VALID_USER_TOKEN} from '../tests/constants';

export const login = (idNumber, lastDigits) => idNumber === VALID_ID && lastDigits === VALID_DIGITS
    ? Promise.resolve(VALID_USER_TOKEN)
    : Promise.reject(new Error('Invalid partner credentials'));

export const getTvContractsData = userAuth => userAuth === VALID_USER_TOKEN
    ? Promise.resolve([{userName: VALID_USERNAME, devices: [{}]}])
    : Promise.reject(new Error('Invalid partner/tv tokens'));
