// Simple script to generate a test WAV file with silence
const fs = require('fs');
const path = require('path');

// WAV file header for 1 second of silence
// 44100 Hz, 16-bit, mono
function createSilentWAV(durationSeconds) {
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const channels = 1;
  const bytesPerSample = bitsPerSample / 8;
  
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * channels * bytesPerSample;
  const fileSize = 44 + dataSize; // 44 bytes for header + data
  
  const buffer = Buffer.alloc(fileSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Fill with silence (zeros)
  // Buffer is already filled with zeros by default
  
  return buffer;
}

// Generate 30 second files
const intro = createSilentWAV(30);
const lesson = createSilentWAV(60);

fs.writeFileSync(path.join(__dirname, 'tts', 'intro-narration.wav'), intro);
fs.writeFileSync(path.join(__dirname, 'tts', 'lesson-narration.wav'), lesson);

console.log('Test WAV files generated successfully');
console.log('intro-narration.wav: 30 seconds of silence');
console.log('lesson-narration.wav: 60 seconds of silence');