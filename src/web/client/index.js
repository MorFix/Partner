window.videojs.Html5DashJS.hook('beforeinitialize', (videoJsPlayer, dashPlayer) => {
    dashPlayer.extend('RequestModifier', () => ({
        modifyRequestHeader: xhr => xhr,
        modifyRequestURL: url => modifyRequestURL(url, videoJsPlayer.dashUrl)
    }));
});

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
    const parsedDrm = new URL(drm);

    addQuery(parsedDrm, { proxyhost: parsedDrm.origin, forceProxy: true });

    const player = window.videojs('videoPlayer', {fluid: true});

    player.ready(() => {
        player.dashUrl = dashUrl;

        player.src({
            src: getPathAndQuery(new URL(dashUrl)),
            type: 'application/dash+xml',
            keySystemOptions: [{name: 'com.widevine.alpha', options: {serverURL: getPathAndQuery(parsedDrm)}}]
        });

        player.play();
    });
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
        .then(res => res.json());
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

        message.innerHTML = 'Logged in';
        
        await fetchChannels();
    } catch (err) {
        message.innerHTML = err.message;

        console.log(err);
    }
};

const renderChannels = (channels, container) => {
    channels
        .map(channel => {
            const option = document.createElement('option');

            option.setAttribute('value', channel.id);
            option.innerHTML = channel.name;
            option.channel = channel;

            return option;
        })
        .forEach(channelElem => {
            container.appendChild(channelElem);
        });
};

const fetchChannels = async () => {
    const channelsContainer = document.getElementById('channels');
    const channelMessage = document.getElementById('channelMessage');

    channelMessage.innerHTML = 'Loading channels...';

    try {
        const channels = await fetchWithUser('/api/channels');

        channelMessage.innerHTML = '';
        channelsContainer.innerHTML = '';

        renderChannels(channels, channelsContainer);
    } catch (err) {
        channelMessage.innerHTML = err.message;

        console.log(err);
    }
};

const loadChannel = async ({id, name}) => {
    const channelMessage = document.getElementById('channelMessage');

    channelMessage.innerHTML = `Loading ${name}...`;

    try {
        const channel = await fetchWithUser(`/api/channels/${id}`);
        
        loadStream(channel);

        channelMessage.innerHTML = '';
    } catch (err) {
        channelMessage.innerHTML = err.message;

        console.log(err);
    }
};

const channelsSelect = document.getElementById('channels');
const setChannel = () => {
    const selectedOption = Array.from(channelsSelect).find(x => x.value === channelsSelect.value);
    if (selectedOption) {
        loadChannel(selectedOption.channel);
    }
};

window.addEventListener('load', onPageLoaded);
document.getElementById('loginForm').addEventListener('submit', login);

document.getElementById('loadChannelButton').addEventListener('click', setChannel);
document.getElementById('channels').addEventListener('change', setChannel);