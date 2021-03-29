import axios from 'axios';

const MOR_USER = 113307468;

export default (channelId, userId = MOR_USER) => {
    const DRM = 'https://sno.partner.co.il/WV/Proxy/DRM?AssetId=' + channelId + '&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false';
	
	const url = 'https://pub.partner.co.il/traxis/web/Session/propset/all?Output=json&CustomerId=' + userId + '&SeacToken=fed1cee4-1a36-4a8f-a1c3-a511da744756&SeacClass=personal';
	
	const data = '<CreateSession><ChannelId>' + channelId + '</ChannelId></CreateSession>'
	
	const options = {
	  headers: {
		'Content-Type': 'text/xml',
		'Content-Length': data.length,
		'User-Agent': 'iFeelSmart-Android_MOBILE_AVC_L3',
		'charset': 'utf-8',
		'Connection': 'keep-alive'
	  }	
	};
	
	return axios.post(url, data, options)
		.then(r => ({
            manifest: r.data.Session.Playlist.Channel.Value.replace('http', 'https'),
            drm: DRM 
        }))
        .catch(e => Promise.reject(e.response?.data?.Error?.Message ?? e));
};