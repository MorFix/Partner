import React from 'react';
import {StyleSheet, View, Text, TextInput} from 'react-native';

import Section from '../Section';

export default function LinksData({linksData}) {
    if (!linksData) {
        return null;
      }

      const children = !linksData.manifest ? <Text>Loading...</Text> :
        (
            <View>
                <Text style={styles.text}>Manifest URL</Text>
                <TextInput style={styles.textBox} editable={true} value={linksData.manifest} />
                
                <Text style={styles.text}>DRM License URL</Text>
                <TextInput style={styles.textBox} editable={true} value={linksData.drm}></TextInput>
            </View>
        );

      return (<Section title="Links">
          {children}
      </Section>)
};

const styles = StyleSheet.create({
    text: {
        fontWeight: 'bold'
    },
    textBox: {
        backgroundColor: 'white'
    }
})