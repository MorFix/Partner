package com.morfix.partnertv.ui

import android.os.Bundle
import androidx.leanback.app.VideoSupportFragment
import androidx.leanback.app.VideoSupportFragmentGlueHost
import androidx.leanback.media.PlaybackTransportControlGlue
import androidx.leanback.widget.PlaybackControlsRow
import com.google.android.exoplayer2.C
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.SimpleExoPlayer
import com.google.android.exoplayer2.ext.leanback.LeanbackPlayerAdapter
import com.google.android.exoplayer2.util.MimeTypes

/** Handles video playback with media controls. */
class PlaybackVideoFragment : VideoSupportFragment() {

    private lateinit var mTransportControlGlue: PlaybackTransportControlGlue<LeanbackPlayerAdapter>

    private val viewBinding by lazy(LazyThreadSafetyMode.NONE) {

    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val (_, title, description, _, _, videoUrl) =
            activity?.intent?.getSerializableExtra("Movie") as PartnerMedia

        val glueHost = VideoSupportFragmentGlueHost(this@PlaybackVideoFragment)

        val exoPlayer = SimpleExoPlayer.Builder(requireContext())
            .build()

        val mediaItem = MediaItem.Builder()
            .setUri("http://bkmf.partner.co.il/1471/1471.isml/manifest.mpd?I=f5c3f80f-7616-4be1-a9b1-78272be0a6e1&K=76&E=20210731225605&A=77.125.166.187&H=B23E855FEF3BF1C4D48E5D73F4EFC47E")
            .setDrmLicenseUri("https://sno.partner.co.il/WV/Proxy/DRM?AssetId=1470&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false")
            .setDrmUuid(C.WIDEVINE_UUID)
            .setMimeType(MimeTypes.APPLICATION_MPD)
            .setDrmMultiSession(true)
            .build()

        exoPlayer.addMediaItem(mediaItem)

        val playerAdapter = LeanbackPlayerAdapter(requireContext(), exoPlayer, 100)

        playerAdapter.setRepeatAction(PlaybackControlsRow.RepeatAction.INDEX_NONE)

        mTransportControlGlue = PlaybackTransportControlGlue(activity, playerAdapter)
        mTransportControlGlue.host = glueHost
        mTransportControlGlue.title = title
        mTransportControlGlue.subtitle = description
        mTransportControlGlue.playWhenPrepared()

        exoPlayer.prepare()
    }

    override fun onPause() {
        super.onPause()
        mTransportControlGlue.pause()
    }
}