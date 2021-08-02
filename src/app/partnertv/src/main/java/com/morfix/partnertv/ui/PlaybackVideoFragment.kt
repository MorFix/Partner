package com.morfix.partnertv.ui

import android.os.Bundle
import androidx.leanback.app.VideoSupportFragment
import androidx.leanback.app.VideoSupportFragmentGlueHost
import androidx.leanback.media.PlaybackTransportControlGlue
import androidx.leanback.widget.PlaybackControlsRow
import androidx.lifecycle.lifecycleScope
import com.google.android.exoplayer2.C
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.SimpleExoPlayer
import com.google.android.exoplayer2.ext.leanback.LeanbackPlayerAdapter
import com.google.android.exoplayer2.util.MimeTypes
import com.morfix.partnertv.lib.TvPartner
import com.morfix.partnertv.lib.data.UserData
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/** Handles video playback with media controls. */
class PlaybackVideoFragment : VideoSupportFragment() {

    private lateinit var mTransportControlGlue: PlaybackTransportControlGlue<LeanbackPlayerAdapter>

    private val viewBinding by lazy(LazyThreadSafetyMode.NONE) {

    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val (id, title, description, _, _) =
            activity?.intent?.getSerializableExtra("Movie") as PartnerMedia

        val glueHost = VideoSupportFragmentGlueHost(this@PlaybackVideoFragment)
        val exoPlayer = SimpleExoPlayer.Builder(requireContext()).build()

        val playerAdapter = LeanbackPlayerAdapter(requireContext(), exoPlayer, 100)

        playerAdapter.setRepeatAction(PlaybackControlsRow.RepeatAction.INDEX_NONE)

        mTransportControlGlue = PlaybackTransportControlGlue(activity, playerAdapter)
        mTransportControlGlue.host = glueHost
        mTransportControlGlue.title = title
        mTransportControlGlue.subtitle = description
        mTransportControlGlue.playWhenPrepared()

        runBlocking {
            launch {
                val session = TvPartner().createSession(id, UserData())
                if (session != null) {
                    val mediaItem = MediaItem.Builder()
                        .setUri(session.dashUrl)
                        .setDrmLicenseUri(session.drm)
                        .setDrmUuid(C.WIDEVINE_UUID)
                        .setMimeType(MimeTypes.APPLICATION_MPD)
                        .setDrmMultiSession(true)
                        .build()

                    exoPlayer.addMediaItem(mediaItem)
                    exoPlayer.prepare()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        mTransportControlGlue.pause()
    }
}