import proxy from 'express-http-proxy';

const PROXY_HOST_QUERY_NAME = 'proxyhost';

const userResHeaderDecorator = headers => {
    if (headers.location) {
        const url = new URL(headers.location);
        url.searchParams.append(PROXY_HOST_QUERY_NAME, url.origin);

        headers.location = url.pathname + url.search;
    }
    
    return headers;
};

export const isUsingProxy = () => process.env.PROXY === '1'; 

export default (req, res, next) => {
    const usingProxy = isUsingProxy();
    
    if (!usingProxy && req.query.forceProxy !== 'true') {
        next();

        return;
    }

    const proxyHost = req.query[PROXY_HOST_QUERY_NAME];
    if (!proxyHost) {
        next();

        return;
    }

    const options = usingProxy ? {userResHeaderDecorator} : {};
        
    proxy(proxyHost, options)(req, res, next);
};