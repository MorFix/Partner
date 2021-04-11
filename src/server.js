import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import dotenv from 'dotenv';
import express from 'express';
import proxy from 'express-http-proxy';
import open from 'open';

import {login, getChannels, createSession} from './partner.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use('/proxy', proxy('https://sno.partner.co.il/'));
app.use(express.json());
app.use(express.static(resolve(__dirname, 'client')));

const handleUser = (req, res, next) => {
    const {userid: userId, token} = req.headers;
    
    req.user = {userId, token};

    next();
};

const tryAsyncMethod = async (res, method) => {
    try {
		const result = await method();
    
        res.json(result);
	} catch (error) {
		console.log(error);

        res.status(500);
        res.end();
	}
};

app.post('/api/login', async (req, res) => {
    const {email = process.env.DEFAULT_USER, password = process.env.DEFAULT_PASSWORD} = req.body;

    tryAsyncMethod(res, () => login(email, password));
});

app.get('/api/channels', handleUser, ({user}, res) => {    
    tryAsyncMethod(res, () => getChannels(user));
});

app.get('/api/channels/:id', handleUser, (req, res) => {
    tryAsyncMethod(res, async () => {
        const session = await createSession(req.params.id, req.user);

        return {...session, drm: `/proxy${session.drm}`};
    });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Listening on ${PORT}...`);

    open(`http://localhost:${PORT}/`);
});