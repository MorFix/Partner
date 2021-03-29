import React, {useState} from 'react';
import {Picker} from '@react-native-picker/picker';
import Channels from '../../lib/channels.const';

import Section from '../Section';

export default ({onChannelChanged}) => {
    const [channel, setChannel] = useState(null);

    const onValueChanged = newValue => {
        setChannel(newValue);
        onChannelChanged(newValue);
    };

    const avaiableChannels = Object.keys(Channels);

    return (
        <Section title="Choose channel">
          <Picker selectedValue={channel} onValueChange={onValueChanged}>
            {avaiableChannels.map(name => (<Picker.Item key={name} label={name} value={name} />))}
          </Picker>
        </Section>
    );
};