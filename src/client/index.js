// TODO: Handle errors with messages

const loadStream = ({dashUrl, drm}) => {
    const player = window.dashjs.MediaPlayer().create();
    const protection = {"com.widevine.alpha": {serverURL: drm}};

    player.setProtectionData(protection);

    player.initialize(document.querySelector("#videoPlayer"), dashUrl, true);    
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

    return result.ok ? result : Promise.reject('Request failed!');
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
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const res = await fetchWithError('/api/login', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({email, password})
    });

    const user = await res.json();

    setUser(user);
    fetchChannels();
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

window.addEventListener('load', onPageLoaded);
document.getElementById('loginButton').addEventListener('click', login);
document.getElementById('channels').addEventListener('change', e => {
    loadChannel(e.target.value);
});