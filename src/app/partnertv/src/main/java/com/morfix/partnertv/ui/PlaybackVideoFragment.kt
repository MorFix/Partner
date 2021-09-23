package com.morfix.partnertv.ui

import android.content.Context
import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import androidx.leanback.app.VideoSupportFragment
import androidx.leanback.app.VideoSupportFragmentGlueHost
import androidx.leanback.media.PlaybackTransportControlGlue
import androidx.leanback.media.PlayerAdapter
import androidx.leanback.widget.*
import com.google.android.exoplayer2.*
import com.google.android.exoplayer2.Player.*
import com.google.android.exoplayer2.ext.leanback.LeanbackPlayerAdapter
import com.google.android.exoplayer2.util.MimeTypes
import com.morfix.partnertv.lib.TvPartner
import com.morfix.partnertv.lib.data.UserData
import kotlinx.coroutines.*

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

        mTransportControlGlue = CustomPlaybackTransportControlGlue(requireActivity(), playerAdapter)
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

        val listener : Listener = object : Listener {
            override fun onPlayerError(error: ExoPlaybackException) {
                super.onPlayerError(error)

                close(error)
            }

            override fun onPlaybackStateChanged(state: Int) {
                mTransportControlGlue.subtitle = when (state) {
                    STATE_IDLE,
                    STATE_BUFFERING -> "Loading..."
                    STATE_READY -> subtitle
                    else -> null
                }
            }
        }

        player.addListener(listener)

        return player
    }

    private fun initChannel(id: Long) {
        CoroutineScope(Dispatchers.IO).launch {
            val session = TvPartner().createSession(id, UserData())
            if (session != null) {
                val mediaItem = MediaItem.Builder()
                    .setUri(session.dashUrl)
                    .setDrmLicenseUri(session.drm)
                    .setDrmUuid(C.WIDEVINE_UUID)
                    .setMimeType(MimeTypes.APPLICATION_MPD)
                    .setDrmMultiSession(true)
                    .build()

                withContext(Dispatchers.Main) {
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

class CustomPlaybackTransportControlGlue<T : PlayerAdapter>(
    private val mContext: Context,
    adapter: T)
    : PlaybackTransportControlGlue<T>(mContext, adapter) {

    private lateinit var rewindAction : PlaybackControlsRow.RewindAction
    private lateinit var forwardAction : PlaybackControlsRow.FastForwardAction
    private lateinit var seekToLiveAction : PlaybackControlsRow.SkipNextAction

    private val skipMilliseconds = 60 * 1000

    override fun onCreatePrimaryActions(primaryActionsAdapter: ArrayObjectAdapter?) {
        rewindAction = PlaybackControlsRow.RewindAction(mContext, 5)
        forwardAction = PlaybackControlsRow.FastForwardAction(mContext, 5)
        seekToLiveAction = PlaybackControlsRow.SkipNextAction(mContext)

        primaryActionsAdapter?.add(rewindAction)
        super.onCreatePrimaryActions(primaryActionsAdapter)
        primaryActionsAdapter?.add(forwardAction)
        primaryActionsAdapter?.add(seekToLiveAction)
    }

    override fun onActionClicked(action: Action?) {
        when(action) {
            rewindAction -> rewind()
            forwardAction -> forward()
            seekToLiveAction -> seekToLive()
            else -> super.onActionClicked(action)
        }
    }

    private fun rewind() {
        playerAdapter.seekTo(currentPosition - skipMilliseconds)
    }

    private fun forward() {
        playerAdapter.seekTo(currentPosition + skipMilliseconds)
    }

    private fun seekToLive() {
        playerAdapter.seekTo(playerAdapter.duration)
    }
}