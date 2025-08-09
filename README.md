# CBTPlayer - CBT Multimedia Synchronization Prototype

Computer Based Training Content Player - A desktop application for synchronized playback of multiple media types (video, audio, subtitles, HTML) along a global timeline with variable playback speeds.

## Features

- **Global Timeline Control**: Master clock synchronizes all media elements
- **Multi-Track Support**: Video, audio (TTS), subtitles (WebVTT), and HTML panels
- **Variable Playback Speed**: 0.5x to 2.0x with pitch-preserved audio
- **Precision Synchronization**: ±50ms tolerance with automatic drift correction
- **Content Packages**: Organized ZIP/PAK format with manifest-based timeline

## Technology Stack

- **Frontend**: React + TypeScript
- **Desktop**: Electron
- **Audio Processing**: WebAudio API + SoundTouch.js (pitch preservation)
- **TTS**: Coqui TTS support
- **Build**: Webpack

## Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## Development

```bash
# Run in development mode with hot reload
npm run dev
```

## Project Structure

```
CBTPoc/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React application
│   │   ├── components/ # UI components
│   │   ├── services/   # MasterClock service
│   │   ├── managers/   # Media track managers
│   │   └── App.tsx     # Main app component
│   └── types/          # TypeScript definitions
├── content/            # Sample content packages
└── public/            # Static assets
```

## Content Package Format

Content packages follow this structure:

```
package.zip/
├── manifest.json      # Timeline and metadata
├── videos/           # Video files (MP4)
├── tts/             # TTS audio files (MP3)
├── subtitles/       # WebVTT subtitle files
└── desc/            # HTML description panels
```

### Manifest Example

```json
{
  "version": "1.0",
  "duration_ms": 180000,
  "tracks": [
    {
      "id": "video-track",
      "type": "video",
      "items": [
        {
          "id": "clip1",
          "file": "videos/clip1.mp4",
          "start_ms": 0,
          "duration_ms": 60000
        }
      ]
    }
  ]
}
```

## Synchronization Architecture

The system uses a **MasterClock** service that:
1. Maintains global timeline position
2. Emits timing events at 60fps
3. Coordinates all track managers
4. Handles playback rate changes

Track managers subscribe to clock events and:
- Sync their media elements every 200ms
- Apply drift correction when needed
- Maintain playback rate consistency

## Testing the Prototype

1. **Load Sample Content**: Click "Load Sample Content" to test with pre-made content
2. **Open Package**: Use "Open Content Package" to load your own ZIP/manifest
3. **Playback Controls**: Play/pause, change speed (0.5x-2x), seek timeline
4. **Monitor Sync**: Watch the sync indicator for real-time status

## Sample Content

The `content/sample-package/` folder contains example content demonstrating:
- Multiple video clips with transitions
- Synchronized subtitles in WebVTT format
- HTML description panels with styling
- Manifest configuration

## Performance Considerations

- **Clock Drift**: Corrected every 200ms with ±50ms tolerance
- **Frame Precision**: Uses `requestVideoFrameCallback` for Chrome-based browsers
- **Audio Quality**: WebAudio + SoundTouch.js for pitch preservation
- **Buffering**: Automatic prefetch and progressive loading

## Known Limitations

- Requires Chrome-based browser engine (Electron)
- Audio pitch preservation depends on SoundTouch.js availability
- Very low (<0.25x) or high (>2x) playback rates may have quality issues

## Future Enhancements

- [ ] HLS/DASH support for adaptive streaming
- [ ] Real-time TTS generation with Coqui
- [ ] Interactive HTML panel communication
- [ ] Multi-language subtitle support
- [ ] Performance metrics dashboard
- [ ] Content package editor

## License

MIT
