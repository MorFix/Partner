package com.morfix.partnertv.ui

import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import androidx.leanback.app.VideoSupportFragment
import androidx.leanback.app.VideoSupportFragmentGlueHost
import androidx.leanback.media.PlaybackTransportControlGlue
import androidx.leanback.widget.PlaybackControlsRow
import com.google.android.exoplayer2.*
import com.google.android.exoplayer2.ext.leanback.LeanbackPlayerAdapter
import com.google.android.exoplayer2.util.MimeTypes
import com.morfix.partnertv.lib.TvPartner
import com.morfix.partnertv.lib.data.UserData
import kotlinx.coroutines.*
import java.lang.Exception

/** Handles video playback with media controls. */
@ExperimentalCoroutinesApi
class PlaybackVideoFragment : VideoSupportFragment() {

    private lateinit var mTransportControlGlue: PlaybackTransportControlGlue<LeanbackPlayerAdapter>
    private var exoPlayer: ExoPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val (id, title, description, _, _) =
            activity?.intent?.getSerializableExtra("Movie") as PartnerMedia

        exoPlayer = createExoPlayer(description)

        requireActivity().window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val playerAdapter = LeanbackPlayerAdapter(requireContext(), exoPlayer!!, 100)
        playerAdapter.setRepeatAction(PlaybackControlsRow.RepeatAction.INDEX_NONE)

        mTransportControlGlue = PlaybackTransportControlGlue(activity, playerAdapter)
        mTransportControlGlue.host = VideoSupportFragmentGlueHost(this)
        mTransportControlGlue.title = title
        mTransportControlGlue.subtitle = "Loading..."
        mTransportControlGlue.playWhenPrepared()

        initChannel(id)
    }

    override fun onPause() {
        super.onPause()
        mTransportControlGlue.pause()
    }

    override fun onDestroy() {
        super.onDestroy()

        exoPlayer?.release()
    }

    private fun createExoPlayer(subtitle: String?): ExoPlayer {
        val player = SimpleExoPlayer.Builder(requireContext()).build()
        player.prepare()

        val listener : Player.Listener = object : Player.Listener {
            override fun onPlayerError(error: ExoPlaybackException) {
                super.onPlayerError(error)

                close(error)
            }

            override fun onRenderedFirstFrame() {
                super.onRenderedFirstFrame()

                mTransportControlGlue.subtitle = subtitle
            }
        }

        player.addListener(listener)

        return player
    }

    private fun initChannel(id: Long) {
        CoroutineScope(Dispatchers.IO).launch {
            val mainScope = CoroutineScope(Dispatchers.Main)

            val session = TvPartner().createSession(id, UserData())
            if (session != null) {
                val mediaItem = MediaItem.Builder()
                    .setUri(session.dashUrl)
                    .setDrmLicenseUri(session.drm)
                    .setDrmUuid(C.WIDEVINE_UUID)
                    .setMimeType(MimeTypes.APPLICATION_MPD)
                    .setDrmMultiSession(true)
                    .build()

                mainScope.launch {
                    exoPlayer?.addMediaItem(mediaItem)
                }
            } else {
                close(Exception("Can't find a link for this channel"))
            }
        }
    }

    private fun close(e: Throwable) {
        CoroutineScope(Dispatchers.Main).launch {
            Toast.makeText(requireContext(), e.message, Toast.LENGTH_LONG)
                .show()

            requireActivity().finish()
        }
    }
}