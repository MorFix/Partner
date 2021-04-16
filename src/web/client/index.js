let currentPlayer;

const addQuery = (url, payload) => {
    Object.keys(payload)
        .filter(key => !url.searchParams.has(key))
        .forEach(key => {
            url.searchParams.append(key, payload[key]);
        });
};

const getPathAndQuery = ({pathname, search}) => pathname + search; 

const modifyRequestURL = (url, dashUrl) => {
    const requestUrl = new URL(url, window.origin);
    const parsedDash = new URL(dashUrl);
    const query = { proxyhost: requestUrl.origin };

    if (url === getPathAndQuery(parsedDash)) {
        query.proxyhost = parsedDash.origin;
        query.forceProxy = true;
    }

    addQuery(requestUrl, query);

    return requestUrl.toString();
};

const loadStream = ({dashUrl, drm}) => {
    currentPlayer?.reset();

    const parsedDrm = new URL(drm);

    addQuery(parsedDrm, { proxyhost: parsedDrm.origin, forceProxy: true });
    
    const player = currentPlayer = window.dashjs.MediaPlayer().create();
    const protection = {"com.widevine.alpha": {serverURL: getPathAndQuery(parsedDrm)}};

    player.setProtectionData(protection);

    player.extend('RequestModifier', () => ({
        modifyRequestHeader: xhr => xhr,
        modifyRequestURL: url => modifyRequestURL(url, dashUrl)
    }));

    player.initialize(document.querySelector("#videoPlayer"), getPathAndQuery(new URL(dashUrl)), true);    
};

const getUser = () => {
    const userId = window.localStorage.getItem('userId');
    const token = window.localStorage.getItem('token');

    if (!userId || !token) {
        return null;
    }

    return {userId, token};
};

const fetchWithError =  async (url, options) => {
    const result = await fetch(url, options);
    if (result.ok) {
        return result;
    }

    const error = await result.json();
    
    return Promise.reject(error);
};

const fetchWithUser = (url, options = {}) => {
    const user = getUser();
    if (!user) {
        return Promise.reject('Cannot fetch before login')
    }

    options.headers = options.headers || {};
    
    Object.assign(options.headers, user);

    return fetchWithError(url, options)
        .then(res => res.json())
        .catch(err => {
            alert(err.message);

            console.log(err);

            return Promise.reject(err);
        });
}; 

const onPageLoaded = () => {
    const user = getUser();
    if (!user) {
        return;
    }

    fetchChannels();
};

const setUser = ({userId, token}) => {
    window.localStorage.setItem('userId', userId);
    window.localStorage.setItem('token', token);
};

const login = async () => {
    const idNumber = document.getElementById('idNumber').value;
    const lastDigits = document.getElementById('lastDigits').value;
    const password = document.getElementById('password').value;
    
    const message = document.getElementById('loginMessage');
    
    message.innerHTML = 'Logging in...';

    try {
        const res = await fetchWithError('/api/login', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({idNumber, lastDigits, password})
        });
    
        const user = await res.json();
        
        setUser(user);
        await fetchChannels();

        message.innerHTML = 'Logged in';
    } catch (err) {
        message.innerHTML = err.message;

        console.log(err);
    }
};

const fetchChannels = async () => {
    const channels = await fetchWithUser('/api/channels');
    const channelsContainer = document.getElementById('channels');

    channelsContainer.innerHTML = '';

    channels
        .map(channel => {
            const option = document.createElement('option');

            option.setAttribute('value', channel.id);
            option.innerHTML = channel.name;
            option.channel = channel;

            return option;
        })
        .forEach(channelElem => {
            channelsContainer.appendChild(channelElem);
        });
};

const loadChannel = async id => {
    const channel = await fetchWithUser(`/api/channels/${id}`);

    loadStream(channel);
};

const channelsSelect = document.getElementById('channels');
const setChannel = () => loadChannel(channelsSelect.value);

window.addEventListener('load', onPageLoaded);
document.getElementById('loginForm').addEventListener('submit', login);

document.getElementById('loadChannelButton').addEventListener('click', setChannel);
document.getElementById('channels').addEventListener('change', setChannel);