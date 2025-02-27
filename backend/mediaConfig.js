export default {
    // MediaSoup Worker Settings
    worker: {
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp'
        ],
    },

    // Router settings (used for RTP codecs)
    router: {
        mediaCodecs: [
            {
                kind: "audio",
                mimeType: "audio/opus",
                clockRate: 48000,
                channels: 2
            },
            {
                kind: "video",
                mimeType: "video/VP8",
                clockRate: 90000
            },
            {
                kind: "video",
                mimeType: "video/H264",
                clockRate: 90000,
                parameters: {
                    "packetization-mode": 1
                }
            }
        ]
    },

    // WebRTC Transport settings
    webRtcTransport: {
        listenIps: [
            { ip: "0.0.0.0", announcedIp: null } // Change `YOUR_PUBLIC_IP` for production
        ],
    }
};
