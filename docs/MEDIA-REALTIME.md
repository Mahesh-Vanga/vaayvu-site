# Media and real-time work (P27)

P27 covers playback quality and call protections. Neither has a real-device
verification in this environment.

## Playback

| Area | State |
|---|---|
| Engine playback | Chromium/WebView/WKWebView native media |
| YouTube optimization | `youtubeOptimize`, ad overlay handling, one-video-at-a-time |
| Picture-in-picture | respected by the YouTube helper |
| PiP/background throttling | hidden tabs throttled; audible tabs protected from sleep |
| Playback quality metrics | **not measured** |
| Real-device playback (phone/tablet/TV) | **not run** |

No `getVideoPlaybackQuality` corpus, dropped-frame trace or device matrix exists.
A playback-quality claim would require real devices and a controlled stream.

## Real-time calls and screen share

| Control | State |
|---|---|
| Camera/microphone permission | Session handlers deny by default; site prompts explicit |
| Screen share | **No product flow** |
| WebRTC IP handling policy | **Not configured** |
| Call protection screen | Contract (`s-522`–`s-527`) |
| Real-device call test | **Not run** |

The browser does not implement a call product. Screens describe call protection
and device selection, but no WebRTC call path, ICE policy, codec negotiation or
screen-share consent flow is wired.

## Safe defaults

- Permission requests are denied unless the user grants them in a site prompt.
- Private tabs do not persist grants.
- Audible tabs are never slept by pressure relief.
- Hidden tabs are frame-rate throttled, not muted.
- Downloads/uploads/calls can request a P18 critical-work lease.

## Exit gate

| Gate item | State |
|---|---|
| Verified playback quality | **No** — no device/stream measurement |
| Call protections | **No product call path** |
| Real-device verification | **Not run** |
| Gate met | **No** |

P27 is **blocked** on a real-device media lab and an actual call/WebRTC path.
Screens and safe permission defaults are not evidence of either.
