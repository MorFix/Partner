import dotenv from 'dotenv';
import {login, getChannels, createSession} from './partner.js';
import promptSync from 'prompt-sync';

dotenv.config();
const prompt = promptSync({sigint: true});

const askForChannel = channels => {
	let choice = process.argv[2];
	const channelsKeys = Object.keys(channels);

	const message = ['Please choose a channel number:', ...channelsKeys.map((x, i) => i + '. ' + x)].join('\n')

	let channelKey = channelsKeys[choice],
		channelId = channels[channelKey];

	while (!channelId) {
		console.log(message);
		choice = prompt();
		
		channelKey = channelsKeys[choice];
		channelId = channels[channelKey];
		console.log('');
	}

	return {name: channelKey, id: channelId};
};

const getChannelsViewData = channelsResponse => channelsResponse.reduce((all, {name, id}) => ({...all, [name]: id}), {});;

const main = async () => {
	try {
		const user = await login(process.env.DEFAULT_USER, process.env.DEFAULT_PASSWORD);
        const channels = getChannelsViewData(await getChannels(user));
		const {name, id} = askForChannel(channels);

        const {dashUrl, drm} = await createSession(id, user);

		console.log(`Generating links for ${name}...\n`);
		console.log('Paste HERE:\nhttps://bitmovin.com/demos/drm\n');
		
		console.log(`DASH Manifest: \n${dashUrl.replace('http', 'https')}\n`);
		console.log(`DRM License Server: \nhttps://sno.partner.co.il${drm}`);
	} catch (error) {
		console.log(error);
	}
}

main();