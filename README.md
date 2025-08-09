# CBTPlayer - CBT Multimedia Synchronization Prototype

[![Build Status](https://github.com/jaguarcode/CBTPlayer/workflows/Build%20and%20Release/badge.svg)](https://github.com/jaguarcode/CBTPlayer/actions)
[![CodeQL](https://github.com/jaguarcode/CBTPlayer/workflows/CodeQL%20Security%20Analysis/badge.svg)](https://github.com/jaguarcode/CBTPlayer/security/code-scanning)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/electron-28.0.0-blue)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/jaguarcode/CBTPlayer/releases)

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

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **Build & Test**: Runs on every push and pull request
- **Multi-Platform Support**: Builds for Windows, macOS, and Linux
- **Automated Releases**: Creates releases when tags are pushed
- **Security Scanning**: CodeQL analysis for vulnerability detection
- **Dependency Updates**: Automated via Dependabot

### Creating a Release

1. Update version in `package.json`
2. Commit changes: `git commit -am "Release v1.0.1"`
3. Create tag: `git tag v1.0.1`
4. Push with tags: `git push origin main --tags`
5. GitHub Actions will automatically build and create a release

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] HLS/DASH support for adaptive streaming
- [ ] Real-time TTS generation with Coqui
- [ ] Interactive HTML panel communication
- [ ] Multi-language subtitle support
- [ ] Performance metrics dashboard
- [ ] Content package editor
- [ ] Automated testing suite
- [ ] Docker container support
- [ ] Web-based version
- [ ] Plugin architecture

## Security

- **Code Scanning**: Automated security analysis with CodeQL
- **Dependency Scanning**: Regular updates via Dependabot
- **Vulnerability Reporting**: Please report security issues to the maintainers

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Video playback powered by [Video.js](https://videojs.com/)
- Audio processing with [SoundTouch.js](https://github.com/cutterbl/SoundTouchJS)
- React for UI components
