# Requirement

전역 타임라인(global timeline)에 따라 여러 개의 개별 비디오(video), HTML 설명창(HTML description panel), 자막(subtitles), **TTS(실시간 TTS)**를 동시에/정밀하게 재생·제어하는 앱을 만들고 싶어.
재생 속도는 1.0x, 0.5x, 1.25x, 1.5x 등으로 바꿀 수 있어야 하고, 속도 변경 시 동기화(비디오 ↔ 자막 ↔ TTS ↔ HTML 이벤트)가 깨지지 않아야 해.

단위 테스트는 생략하고, 콘텐츠 파일을 설계하고 빠르게 검증하기 위한 프로토타입 앱을 개발하고 싶어.

TTS 모델은 <https://github.com/coqui-ai/TTS/tree/dev> 을 사용해.
검증을 위한 샘플 콘텐츠 파일을 구성해야 해.

# Tech Stack

React + Electron (Desktop) 프런트엔드 + Node.js(또는 S3) 파일 서버
브라우저 기반은 아주 정밀한 오디오 타임스트레칭(음성 톤 보존)에서 네이티브 라이브러리만큼 완벽하진 않다. 이 경우 WebAssembly/WASM으로 RubberBand/SoundTouch 포팅을 고려해줘.

# 데이터/패키지 구조 (Content Package format)

데이터 및 패키지 구조는 설계 방법에 따라서 유연하게 변경해도 돼.
아래의 내용은 예시야.

## 패키지(권장: .zip 또는 PAK) 내부 표준 구조 예

/manifest.json            // 타임라인+메타데이터
/videos/
  clip01.mp4
  clip02.mp4
/desc/
  clip01.html
/subtitles/
  clip01.en.vtt
tts/
  clip01.en.mp3

## manifest.json 예시 (타임라인 기반 EDL / Edit Decision List 스타일)

{
  "duration_ms": 180000,
  "tracks": [
    {
      "id": "video-track-1",
      "type": "video",
      "items": [
        {"id":"v1","file":"videos/clip01.mp4","start_ms":0,"duration_ms":30000,"layer":1},
        {"id":"v2","file":"videos/clip02.mp4","start_ms":30000,"duration_ms":45000,"layer":1}
      ]
    },
    {
      "id": "html-track",
      "type": "html",
      "items": [
        {"id":"h1","file":"desc/clip01.html","start_ms":0,"end_ms":30000}
      ]
    },
    {
      "id":"subtitle-track",
      "type":"subtitle",
      "items":[
        {"id":"s1","file":"subtitles/clip01.en.vtt","start_ms":0}
      ]
    },
    {
      "id":"tts-track",
      "type":"audio",
      "items":[
        {"id":"a1","file":"tts/clip01.en.mp3","start_ms":0}
      ]
    }
  ]
}

### 동기화 처리 원칙

비디오/오디오의 currentTime은 master clock에 주기적으로 보정(seek)한다. (예: 200ms마다 허용 오차 ±50ms를 넘으면 맞춤)
비디오 요소는 play() 후 currentTime을 강제로 조정하면 프레임 드롭이 발생할 수 있으므로, 보정 빈도와 크기를 작게 유지.
requestVideoFrameCallback() 사용하면 프레임 수준에서 타임스탬프를 얻어 보정에 활용 가능(크롬 기반).

## Subtitle (WebVTT) & HTML 설명창

자막: WebVTT 파일을 <track kind="subtitles">로 연결하거나, VTT를 파싱해 커스텀 렌더러로 표시(더 세밀한 제어).
HTML 설명창: manifest의 file을 <iframe> 또는 React 컴포넌트로 로드. 로드 시 CORS, sandbox 고려. 설명창 내의 타임링크(예: 특정 자막/구간 클릭)는 master clock에 seek 명령을 보냄.

## TTS 처리 옵션

클라이언트 실시간 속도조절: WebAudio + SoundTouch/SoundtouchJS 또는 WASM RubberBand 사용

## 파일 전송/ 패키지 마운트

Node.js static server 또는 S3 + CloudFront. React/Electron는 fetch/range 요청으로 스트리밍 가능.

# 성능·정밀도 고려사항

- Clock drift 보정: 매 초 또는 프레임 단위로 각 미디어 요소의 currentTime과 master clock 차이를 계산해 보정(예: 보정량 ≤50ms이면 자연스럽게 허용, 초과 시 seek).
- Buffering/IO: 큰 비디오 파일은 초기 프리페치(prefetch)와 적절한 preload 설정 필요. 네트워크 약할 때 재생 지연 발생 → progressive download / adaptive bitrate(필요 시 HLS/DASH) 고려.
- PlaybackRate 한계: 매우 낮은(예: 0.25x) 또는 매우 높은(>2x) 재생에선 브라우저 제한 또는 품질 저하. 미리 테스트 권장.
- Audio pitch preservation: 고품질 요구 시 Rubber Band (GPL/LGPL 라이선스 체크) 또는 상용 라이브러리 고려.
