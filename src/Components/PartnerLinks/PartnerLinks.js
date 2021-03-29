import React, {useState} from 'react';

import {View} from 'react-native';

import Channels from '../../lib/channels.const';
import createTvSession from '../../lib/create-tv-session';
import LinksData from './LinksData';
import ChooseChannel from './ChooseChannel';

export default function PartnerLinks() {
    const [linksData, setLinksData] = useState(null);

    const onChannelChanged = newChannel => {
      setLinksData({});

      createTvSession(Channels[newChannel])
        .then(links => {
          setLinksData(links);
        });
    };

    return (
      <View>
        <ChooseChannel onChannelChanged={onChannelChanged} />
        <LinksData linksData={linksData} />
      </View>
  );
};