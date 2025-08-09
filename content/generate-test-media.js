/**
 * Generate test media files for the CBT prototype
 * This creates placeholder video and audio files for testing
 */

const fs = require('fs');
const path = require('path');

// Create a simple test video file (tiny valid MP4)
// This is a minimal valid MP4 file structure
const createTestVideo = (filename, durationMs) => {
  // Minimal MP4 header for a blank video
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31,
  ]);
  
  fs.writeFileSync(filename, mp4Header);
  console.log(`Created test video: ${filename}`);
};

// Create a simple test audio file (silent WAV)
const createTestAudio = (filename, durationMs) => {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Silent audio data (zeros)
  
  fs.writeFileSync(filename, buffer);
  console.log(`Created test audio: ${filename}`);
};

// Create test files
const sampleDir = path.join(__dirname, 'sample-package');

// Create videos
const videosDir = path.join(sampleDir, 'videos');
createTestVideo(path.join(videosDir, 'intro.mp4'), 30000);
createTestVideo(path.join(videosDir, 'lesson.mp4'), 60000);
createTestVideo(path.join(videosDir, 'outro.mp4'), 30000);

// Create audio files
const ttsDir = path.join(sampleDir, 'tts');
createTestAudio(path.join(ttsDir, 'intro-narration.wav'), 30000);
createTestAudio(path.join(ttsDir, 'lesson-narration.wav'), 60000);

// Update manifest to use WAV files
const manifestPath = path.join(sampleDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Update audio track to use .wav instead of .mp3
const audioTrack = manifest.tracks.find(t => t.type === 'audio');
if (audioTrack) {
  audioTrack.items.forEach(item => {
    item.file = item.file.replace('.mp3', '.wav');
  });
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('\nTest media files created successfully!');
console.log('You can now test the application with these placeholder files.');