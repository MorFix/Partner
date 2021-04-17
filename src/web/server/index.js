import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import dotenv from 'dotenv';
import express from 'express';
import asyncHandler from 'express-async-handler';
import open from 'open';

import dynamicProxy from './dynamic-proxy.js';
import {login, getChannels, createSession, createSessionForce} from '../../lib/tv-partner.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(dynamicProxy);
app.use(express.json());
app.use(express.static(resolve(__dirname, '..', 'client')));

const handleUser = asyncHandler((req, res, next) => {
    const {userid: userId, token} = req.headers;
    
    req.user = {userId, token};

    next();
});

const loginHandler = async (req, res) => {
    const {idNumber = process.env.DEFAULT_ID_NUMBER,
           lastDigits = process.env.DEFAULT_LAST_DIGITS,
           password = process.env.DEFAULT_PASSWORD} = req.body;

    res.json(await login(idNumber, lastDigits, password));
};

const channelsHandler = async ({user}, res) => res.json(await getChannels(user));
const singleChannelHandler = async (req, res) => {
    const sessionCreator = req.query.force === 'true' ? createSessionForce : createSession;

    res.json(await sessionCreator(req.params.id, req.user));
};

app.post('/api/login', asyncHandler(loginHandler));
app.get('/api/channels', handleUser, asyncHandler(channelsHandler));
app.get('/api/channels/:id', handleUser, asyncHandler(singleChannelHandler));

// Errors handler
app.use((error, req, res, next) => {
    console.log(error);

    res.status(500).json({...error, message: error.message});
});

const PORT = process.env.PORT || 80;

app.listen(PORT, () => {
    console.log(`Listening on ${PORT}...`);

    if (!process.argv.includes('--dev')) {
        open(`http://localhost:${PORT}/`);
    }
});
