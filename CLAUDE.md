# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Computer-Based Training (CBT) multimedia synchronization application that coordinates playback of multiple videos, HTML description panels, subtitles, and TTS audio along a global timeline with variable playback speeds (0.5x to 2x).

## Tech Stack

- **Frontend**: React + Electron (Desktop application)
- **Backend**: Node.js file server (or S3 for static content)
- **TTS**: Coqui TTS (https://github.com/coqui-ai/TTS/tree/dev)
- **Audio Processing**: WebAudio API with SoundTouch/RubberBand (via WASM) for pitch-preserved time stretching

## Core Architecture

### Content Package Structure
Content is delivered as packages (ZIP/PAK) containing:
- `/manifest.json` - Timeline and metadata (EDL-style)
- `/videos/` - Video clips (MP4)
- `/desc/` - HTML description files
- `/subtitles/` - WebVTT subtitle files
- `/tts/` - Pre-generated TTS audio (MP3)

### Synchronization Architecture
- **Master Clock**: Global timeline controller managing all media playback
- **Sync Strategy**: Periodic correction (every 200ms) with ±50ms tolerance
- **Media Tracks**: Video, HTML, Subtitle, and Audio tracks run in parallel
- **Playback Rate**: All media elements must respect global playback rate changes

### Key Technical Considerations
1. **Clock Drift Correction**: Use requestVideoFrameCallback() for frame-level timestamps (Chrome-based)
2. **Audio Pitch Preservation**: WASM port of RubberBand/SoundTouch for quality time-stretching
3. **Buffering Strategy**: Prefetch and progressive download for large video files
4. **HTML Content**: Load in iframe or React component with CORS/sandbox considerations
5. **Subtitle Rendering**: Parse WebVTT for custom rendering with precise timing control

## Development Commands

Since this is a new prototype project without existing code:

```bash
# Initialize React + Electron project
npx create-electron-app cbт-poc --template=webpack-typescript

# Install core dependencies
npm install react react-dom
npm install @types/react @types/react-dom --save-dev

# TTS Setup (requires Python environment)
pip install TTS

# For WASM audio processing
npm install soundtouchjs  # or custom RubberBand WASM build
```

## Critical Implementation Notes

1. **Synchronization Tolerance**: Keep seek corrections small (<50ms) to avoid video frame drops
2. **Performance Monitoring**: Track clock drift between master timeline and each media element
3. **Playback Rate Limits**: Test thoroughly at extreme rates (0.25x and >2x) for browser limitations
4. **Network Resilience**: Consider HLS/DASH for adaptive bitrate in poor network conditions

## Manifest.json Schema

The manifest defines the global timeline with multiple tracks:
- `duration_ms`: Total timeline duration
- `tracks[]`: Array of track objects (video, html, subtitle, audio)
- Each track item has: `start_ms`, `duration_ms`/`end_ms`, `file` path, optional `layer`

## Sample Content Requirements

For prototype validation, create sample content with:
- Multiple video clips with transitions
- Synchronized subtitles in WebVTT format
- HTML description panels with interactive elements
- Pre-generated TTS audio files matching subtitle timing