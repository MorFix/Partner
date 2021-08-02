package com.morfix.partnertv.lib
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.morfix.partnertv.lib.data.ChannelData
import com.morfix.partnertv.lib.data.PlaybackSession
import com.morfix.partnertv.lib.data.UserData
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.content.*
import io.ktor.http.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.redundent.kotlin.xml.Node
import org.redundent.kotlin.xml.PrintOptions
import org.redundent.kotlin.xml.xml

class TvPartner {
    fun login() {

    }

    suspend fun getChannels(userData: UserData): ArrayList<ChannelData> {
        val queryData = xml("Request") {
            "Identity" {
                "CustomerId" {
                    - userData.userId
                }
            }
            "RootRelationQuery" {
                attribute("relationName", "Channels")
                "Options" {
                    "Option" {
                        attribute("type", "Props")
                        -"name,pictures"
                    }
                }
            }
        }

        val responseBody = queryTraxis("/Channels", mutableMapOf(), userData.token, queryData)
        val channels = responseBody.getAsJsonObject("Channels").getAsJsonArray("Channel")

        val arrayList = arrayListOf<ChannelData>()

        arrayList.addAll(channels.map {
            val obj = it.asJsonObject

            val pics = obj.getAsJsonObject("Pictures").getAsJsonArray("Picture")
            val logoPic = pics.find { x -> x.asJsonObject["type"].asString == "Logo" }
            val logo = logoPic?.asJsonObject?.get("Value")?.asString

            ChannelData(obj["id"].asString, obj["Name"].asString, logo)
        })

        return arrayList;
    }

    private suspend fun createSessionCore(channelId: Long, userData: UserData): PlaybackSession {
        val creationData = xml("CreateSession") {
            "ChannelId" {
                - channelId.toString()
            }
        }

        val drm = "$SNO_BASE_URL/WV/Proxy/DRM?AssetId=$channelId&RequestType=1&DeviceUID=&RootStatus=false&DRMLevel=3&Roaming=false"

        val query = mutableMapOf(
            "CustomerId" to userData.userId,
            "SeacToken" to userData.token,
            "SeacClass" to "personal"
        )

        val headers = if (channelId == 1250L) {
            mapOf("User-Agent" to "iFeelSmart-Android_MOBILE_AVC_L3")
        } else {
            mapOf()
        }

        val responseBody = queryTraxis("/Session/propset/all", query, userData.token, creationData, headers)
        val dashUrl = responseBody.getAsJsonObject("Session")
            .getAsJsonObject("Playlist")
            .getAsJsonObject("Channel")["Value"].asString

        return PlaybackSession(dashUrl, drm)
    }

    @ExperimentalCoroutinesApi
    suspend fun createSession (channelId: Long, userData: UserData): PlaybackSession? {
        val NUMBER_OF_TRIES = 90
        val TRIES_EACH_DIRECTION = NUMBER_OF_TRIES / 2
        val userId = userData.userId.toInt()

        val sessionsFlow = channelFlow<PlaybackSession?> {
            try {
                this.channel.send(createSessionCore(channelId, userData))
            } catch (e: Throwable) {
                for (i in (userId - TRIES_EACH_DIRECTION) .. (userId + TRIES_EACH_DIRECTION)) {
                    launch {
                        try {
                            val session = createSessionCore(channelId, UserData(i.toString(), userData.token))

                            channel.send(session)
                        } catch (ee: Throwable) {
                            channel.send(null)
                        }
                    }
                }
            }
        }

        return sessionsFlow.dropWhile { it == null }.firstOrNull()
    }

    private suspend fun queryTraxis(path: String, query: MutableMap<String, String> = mutableMapOf(), token: String, data: Node, headers: Map<String, String> = mapOf()) : JsonObject {
        query["Output"] = "json"

        return xmlRequest( "$PUB_BASE_URL/traxis/web$path", query, token, data, headers);
    }

    private suspend fun xmlRequest(url: String, query: Map<String, String>, token: String, data: Node, headers: Map<String, String>) : JsonObject {
        val client = HttpClient {
            expectSuccess = false
        }

        val bodyStr = data.toString(PrintOptions(pretty = false, singleLineTextElements = true, true, indent = ""))
        val response: HttpResponse = client.post(url) {
            headers {
                append("Authorization", "SeacToken token=\"$token\"")
                headers.forEach {
                    append(it.key, it.value)
                }
            }

            query.forEach {
                parameter(it.key, it.value)
            }

            body = TextContent(bodyStr, ContentType.Text.Xml)
        }

        val responseText = response.readText()

        try {
            return Gson().fromJson(responseText, JsonObject::class.java)
        } catch (e: Throwable) {
            throw Exception("Error ${response.status.value}: $responseText")
        }
    }

    companion object {
        private const val BASE_URL = "partner.co.il"
        private const val SNO_BASE_URL = "https://sno.$BASE_URL"
        private const val PUB_BASE_URL = "https://pub.$BASE_URL"
    }
}