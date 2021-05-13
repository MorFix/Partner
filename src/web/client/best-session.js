const isBestStream = ({dashUrl, drm}) => {
    const tempPlayer = window.dashjs.MediaPlayer().create();

    tempPlayer.setProtectionData({"com.widevine.alpha": {serverURL: drm}});
    tempPlayer.initialize(document.createElement("video"), dashUrl, true);

    return new Promise((resolve, reject) => {
        const EVENT = 'manifestUpdated';
        const listener = () => {
            const adapter = tempPlayer.getDashAdapter();

            const [stream] = adapter.getStreamsInfo();
            const adaptation = adapter.getAdaptationForType(stream.index, 'video', stream);

            const isBest = adaptation.Representation_asArray
                .some((_, i) => MediaSource.isTypeSupported(adapter.getCodec(adaptation, i, true)));

            (isBest ? resolve : reject)();

            tempPlayer.off(EVENT, listener);
            tempPlayer.destroy();
        };

        tempPlayer.on(EVENT, listener);
    });
};

window.getBestStream = sessions => {
    const promises = sessions.map(x => new Promise((resolve, reject) => {
        isBestStream(x)
            .then(() => resolve(x))
            .catch(reject)
    }));

    return Promise.any(promises).catch(() => sessions[0]);
};