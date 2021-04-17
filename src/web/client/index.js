window.videojs.Html5DashJS.hook('beforeinitialize', (videoJsPlayer, dashPlayer) => {
    dashPlayer.extend('RequestModifier', () => ({
        modifyRequestHeader: xhr => xhr,
        modifyRequestURL: url => modifyRequestURL(url, videoJsPlayer.dashUrl)
    }));
});

const sessionsContainer = document.getElementById('sessions');

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

const login = async e => {
    e.preventDefault();

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

const renderChannels = channels => {
    const container = document.getElementById('channels');
    container.innerHTML = '';

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
    const channelMessage = document.getElementById('channelMessage');

    channelMessage.innerHTML = 'Loading channels...';

    try {
        const channels = await fetchWithUser('/api/channels');

        channelMessage.innerHTML = '';

        renderChannels(channels);
    } catch (err) {
        channelMessage.innerHTML = err.message;

        console.log(err);
    }
};

const renderSessions = sessions => {
    sessionsContainer.innerHTML = '';

    sessions
        .map((session, index) => {
            const option = document.createElement('option');

            option.setAttribute('value', session.dashUrl);
            option.innerHTML = `Session #${index + 1}`;
            option.session = session;

            return option;
        })
        .forEach(channelElem => {
            sessionsContainer.appendChild(channelElem);
        });
};

const loadChannelForce = async (id, onSuccess, onError) => {    
    try {
        const channelSessions = await fetchWithUser(`/api/channels/${id}?force=true`);

        if (channelSessions.length) {
            sessionsContainer.style.display = 'inline-block';
            
            renderSessions(channelSessions);
            loadStream(channelSessions[0]);
        } else {
            throw new Error('Brute force has failed :(');
        }

        onSuccess();
    } catch (err) {
        onError(err);
    }
};

const loadChannel = async ({id, name}) => {
    const channelMessage = document.getElementById('channelMessage');

    channelMessage.innerHTML = `Loading ${name}...`;
    
    const onError = err => {
        channelMessage.innerHTML = err.message;

        console.log(err);
    };

    const onSuccess = () => {
        channelMessage.innerHTML = '';
    };

    try {
        const session = await fetchWithUser(`/api/channels/${id}`);
        
        loadStream(session);
        onSuccess();
    } catch (err) {
        if (err.additionalData?.InternalError === 'ENotAuthorized' &&
            confirm('You are not authorized to view this channel. Try brute force ?')) {
            
            await loadChannelForce(id, onSuccess, onError);
        } else {
            onError(err);
        }
    }
};

const channelsSelect = document.getElementById('channels');
const setChannel = () => {
    sessionsContainer.style.display = '';

    const selectedOption = Array.from(channelsSelect).find(x => x.value === channelsSelect.value);
    if (selectedOption) {
        loadChannel(selectedOption.channel);
    }
};

const setSession = () => {
    const selectedOption = Array.from(sessionsContainer).find(x => x.value === sessionsContainer.value);
    if (selectedOption) {
        loadStream(selectedOption.session);
    }
}

window.addEventListener('load', onPageLoaded);
document.getElementById('loginForm').addEventListener('submit', login);

document.getElementById('loadChannelButton').addEventListener('click', setChannel);
document.getElementById('channels').addEventListener('change', setChannel);

sessionsContainer.addEventListener('change', setSession);