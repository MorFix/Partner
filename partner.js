const axios = require('axios');
const prompt = require('prompt-sync')({sigint: true});

const MOR_USER = 113307468;

const CHANNELS = {
	KESHSET: 1206,
	SPORT1: 1461,
	SPORT2: 1464,
	SPORT3: 1467,
	SPORT4: 1470,
	SPORT5: 1180,
	'5PLUS': 1182,
	'5GOLD': 1184,
	'5LIVE': 1186,
	'5-4K': 1250,
	RESHET: 1208,
	KAN: 1101
};

let choice;
if (process.argv[2]) {
	choice = process.argv[2]
}

const send = (id, channel = CHANNELS.SPORT4) => {
	const DRM = 'https://sno.partner.co.il/WV/Proxy/DRM?AssetId='+channel+'&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false';
	
	const url = 'https://pub.partner.co.il/traxis/web/Session/propset/all?Output=json&CustomerId='+id+'&SeacToken=fed1cee4-1a36-4a8f-a1c3-a511da744756&SeacClass=personal';
	
	const data = '<CreateSession><ChannelId>'+channel+'</ChannelId></CreateSession>'
	
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
		.then(r => {
			console.log(id + ' DASH Manifest: \n' + r.data.Session.Playlist.Channel.Value.replace('http', 'https'), '\n');
			console.log('DRM License Server: \n' + DRM);
		})
		.catch(e => {
			console.log(id + ': \n' + e.response.data.Error.Message);
		})
};

const channelsKeys = Object.keys(CHANNELS);

const message = ['Please choose a channel number:', ...channelsKeys.map((x, i) => i + '. ' + x)].join('\n')

let channelKey = channelsKeys[choice], channel = CHANNELS[channelKey];
while (!channel) {
	console.log(message);
	choice = prompt();
	
	channelKey = channelsKeys[choice];
	channel = CHANNELS[channelKey];
	console.log('');
}

console.log('Generating links for ' + channelKey + '...\n');
console.log('Paste HERE:');
console.log('https://bitmovin.com/demos/drm\n');

send(MOR_USER, channel);

/*
for (let i = 113307100; i <= 113308000; i++) 
{
	send(i);
}
*/