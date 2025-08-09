/**
 * Download free test media from the internet
 * Uses public domain and Creative Commons content
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Helper function to download a file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percentage = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rDownloading ${path.basename(destPath)}: ${percentage}%`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\n✓ Downloaded ${path.basename(destPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Create directories
const sampleDir = path.join(__dirname, 'sample-package');
const videosDir = path.join(sampleDir, 'videos');
const audioDir = path.join(sampleDir, 'tts');

// Ensure directories exist
[videosDir, audioDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function downloadTestContent() {
  console.log('Downloading free test content from the internet...\n');
  
  try {
    // Download test videos from Pexels (free stock videos)
    // These are short, free videos perfect for testing
    
    console.log('1. Downloading test videos...');
    
    // Video 1: Nature scene (10 seconds)
    // Using Big Buck Bunny clips (open source)
    await downloadFile(
      'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
      path.join(videosDir, 'intro.mp4')
    );
    
    // For additional videos, we'll use the same file for now
    // In a real scenario, you'd download different videos
    if (fs.existsSync(path.join(videosDir, 'intro.mp4'))) {
      fs.copyFileSync(
        path.join(videosDir, 'intro.mp4'),
        path.join(videosDir, 'lesson.mp4')
      );
      console.log('✓ Created lesson.mp4');
      
      fs.copyFileSync(
        path.join(videosDir, 'intro.mp4'),
        path.join(videosDir, 'outro.mp4')
      );
      console.log('✓ Created outro.mp4');
    }
    
    console.log('\n2. Downloading test audio...');
    
    // Download a free music/speech sample
    // Using freesound.org CC0 content or archive.org public domain
    await downloadFile(
      'https://www.soundhealer.com/pages/freedownloads/SampleAudio.wav',
      path.join(audioDir, 'intro-narration.wav')
    ).catch(() => {
      // Fallback: Create a simple test audio if download fails
      console.log('Using generated audio instead...');
      const testAudioPath = path.join(audioDir, 'intro-narration.wav');
      // Copy from our previously generated file if it exists
      if (!fs.existsSync(testAudioPath)) {
        // Generate simple WAV
        generateSimpleWav(testAudioPath, 30000);
      }
    });
    
    // Copy for other audio files
    if (fs.existsSync(path.join(audioDir, 'intro-narration.wav'))) {
      fs.copyFileSync(
        path.join(audioDir, 'intro-narration.wav'),
        path.join(audioDir, 'lesson-narration.wav')
      );
      console.log('✓ Created lesson-narration.wav');
    }
    
    console.log('\n3. Creating enhanced HTML content...');
    createEnhancedHtmlContent();
    
    console.log('\n4. Creating realistic subtitles...');
    createRealisticSubtitles();
    
    console.log('\n5. Updating manifest...');
    updateManifest();
    
    console.log('\n✅ Test package created successfully!');
    console.log('You can now run the application and load the sample content.');
    
  } catch (error) {
    console.error('\n❌ Error downloading content:', error.message);
    console.log('\nFalling back to generated test content...');
    createFallbackContent();
  }
}

function generateSimpleWav(filepath, durationMs) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Generate a simple tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const frequency = 440; // A4 note
    const amplitude = 0.1;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }
  
  fs.writeFileSync(filepath, buffer);
  console.log(`✓ Generated ${path.basename(filepath)}`);
}

function createEnhancedHtmlContent() {
  const introHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            margin: 0;
            animation: fadeIn 1s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { font-size: 36px; margin-bottom: 20px; }
        .demo-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        .feature-list {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        .feature-list li:before {
            content: "✓ ";
            color: #4ade80;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>🎬 Welcome to CBT Demo</h1>
    <div class="demo-info">
        <h2>Multimedia Synchronization Demo</h2>
        <p>This demonstration showcases synchronized playback of:</p>
        <ul class="feature-list">
            <li>High-quality video content</li>
            <li>Synchronized audio narration</li>
            <li>Real-time subtitles</li>
            <li>Interactive HTML panels</li>
            <li>Variable playback speeds</li>
        </ul>
        <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">
            Try changing the playback speed to see how all elements stay perfectly synchronized!
        </p>
    </div>
</body>
</html>`;

  const lessonHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1e1e1e;
            color: #e0e0e0;
            padding: 30px;
            margin: 0;
        }
        h2 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .code-example {
            background: #0d0d0d;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            overflow-x: auto;
        }
        .highlight { color: #fbbf24; font-weight: bold; }
        .info-box {
            background: rgba(102, 126, 234, 0.1);
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
        }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #333;
            border-radius: 15px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            animation: progressFill 60s linear;
        }
        @keyframes progressFill {
            to { width: 100%; }
        }
    </style>
</head>
<body>
    <h2>📚 Main Lesson Content</h2>
    
    <div class="info-box">
        <h3>Synchronization Technology</h3>
        <p>This system uses a <span class="highlight">Master Clock</span> architecture to coordinate multiple media streams.</p>
    </div>
    
    <div class="code-example">
        <pre>
// Master Clock Synchronization
function syncMedia(masterTime) {
    videoManager.sync(masterTime);
    audioManager.sync(masterTime);
    subtitleManager.sync(masterTime);
    htmlManager.sync(masterTime);
}
        </pre>
    </div>
    
    <h3>Lesson Progress</h3>
    <div class="progress-bar">
        <div class="progress-fill"></div>
    </div>
    
    <div class="info-box">
        <h4>Key Features:</h4>
        <ul>
            <li>Frame-accurate video synchronization</li>
            <li>Pitch-preserved audio playback</li>
            <li>Dynamic subtitle rendering</li>
            <li>Responsive HTML content updates</li>
        </ul>
    </div>
</body>
</html>`;

  const outroHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            color: white;
            padding: 40px;
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
        }
        h1 {
            font-size: 48px;
            margin-bottom: 30px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .completion-badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            padding: 20px 40px;
            border-radius: 50px;
            font-size: 24px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            max-width: 400px;
            margin: 30px auto;
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #fbbf24;
        }
        .stat-label {
            font-size: 14px;
            opacity: 0.8;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h1>🎉 Congratulations!</h1>
    
    <div class="completion-badge">
        ✅ Demo Completed Successfully
    </div>
    
    <p style="font-size: 20px; margin: 30px 0;">
        You've experienced the full capabilities of our multimedia synchronization system!
    </p>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-value">100%</div>
            <div class="stat-label">Sync Accuracy</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">4</div>
            <div class="stat-label">Media Types</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">60fps</div>
            <div class="stat-label">Smooth Playback</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">0.5-2x</div>
            <div class="stat-label">Speed Range</div>
        </div>
    </div>
    
    <p style="margin-top: 30px; opacity: 0.8;">
        Thank you for testing the CBT Multimedia Sync System!
    </p>
</body>
</html>`;

  // Write HTML files
  const descDir = path.join(sampleDir, 'desc');
  fs.writeFileSync(path.join(descDir, 'intro.html'), introHtml);
  fs.writeFileSync(path.join(descDir, 'lesson.html'), lessonHtml);
  fs.writeFileSync(path.join(descDir, 'outro.html'), outroHtml);
  
  console.log('✓ Created enhanced HTML content files');
}

function createRealisticSubtitles() {
  const introVtt = `WEBVTT

00:00:00.500 --> 00:00:04.000
Welcome to the Multimedia Synchronization Demo

00:00:04.500 --> 00:00:08.000
This system demonstrates advanced media coordination

00:00:08.500 --> 00:00:12.000
Watch how video, audio, and text stay perfectly synchronized

00:00:12.500 --> 00:00:16.000
Even when you change the playback speed

00:00:16.500 --> 00:00:20.000
All elements adjust in real-time

00:00:20.500 --> 00:00:24.000
Using our Master Clock architecture

00:00:24.500 --> 00:00:28.000
Let's explore the main features

00:00:28.500 --> 00:00:30.000
Starting with the lesson content...`;

  const lessonVtt = `WEBVTT

00:00:00.000 --> 00:00:04.000
Chapter 1: Core Synchronization Concepts

00:00:04.500 --> 00:00:08.000
The Master Clock is the heart of our system

00:00:08.500 --> 00:00:12.000
It coordinates all media elements with precision

00:00:12.500 --> 00:00:16.000
Each manager subscribes to clock events

00:00:16.500 --> 00:00:20.000
Drift correction happens every 200 milliseconds

00:00:20.500 --> 00:00:24.000
Maintaining synchronization within 50ms tolerance

00:00:24.500 --> 00:00:28.000
Video frames are tracked using requestVideoFrameCallback

00:00:28.500 --> 00:00:32.000
Audio pitch is preserved using WebAudio API

00:00:32.500 --> 00:00:36.000
Subtitles update based on the global timeline

00:00:36.500 --> 00:00:40.000
HTML content switches at precise moments

00:00:40.500 --> 00:00:44.000
The system supports multiple playback rates

00:00:44.500 --> 00:00:48.000
From half speed to double speed

00:00:48.500 --> 00:00:52.000
All while maintaining perfect synchronization

00:00:52.500 --> 00:00:56.000
This enables effective educational content delivery

00:00:56.500 --> 00:01:00.000
Thank you for watching this demonstration`;

  const subtitlesDir = path.join(sampleDir, 'subtitles');
  fs.writeFileSync(path.join(subtitlesDir, 'intro.vtt'), introVtt);
  fs.writeFileSync(path.join(subtitlesDir, 'lesson.vtt'), lessonVtt);
  
  console.log('✓ Created realistic subtitle files');
}

function updateManifest() {
  const manifest = {
    "version": "1.0",
    "duration_ms": 120000,
    "metadata": {
      "title": "CBT Multimedia Demo - Internet Content",
      "description": "Demo with real media content from the internet",
      "author": "CBT System",
      "created": new Date().toISOString()
    },
    "tracks": [
      {
        "id": "main-video",
        "type": "video",
        "items": [
          {
            "id": "intro-video",
            "file": "videos/intro.mp4",
            "start_ms": 0,
            "duration_ms": 30000,
            "layer": 1
          },
          {
            "id": "lesson-video",
            "file": "videos/lesson.mp4",
            "start_ms": 30000,
            "duration_ms": 60000,
            "layer": 1
          },
          {
            "id": "outro-video",
            "file": "videos/outro.mp4",
            "start_ms": 90000,
            "duration_ms": 30000,
            "layer": 1
          }
        ]
      },
      {
        "id": "narration",
        "type": "audio",
        "items": [
          {
            "id": "intro-narration",
            "file": "tts/intro-narration.wav",
            "start_ms": 0,
            "duration_ms": 30000
          },
          {
            "id": "lesson-narration",
            "file": "tts/lesson-narration.wav",
            "start_ms": 30000,
            "duration_ms": 60000
          }
        ]
      },
      {
        "id": "subtitles",
        "type": "subtitle",
        "items": [
          {
            "id": "intro-subtitles",
            "file": "subtitles/intro.vtt",
            "start_ms": 0,
            "end_ms": 30000
          },
          {
            "id": "lesson-subtitles",
            "file": "subtitles/lesson.vtt",
            "start_ms": 30000,
            "end_ms": 90000
          }
        ]
      },
      {
        "id": "descriptions",
        "type": "html",
        "items": [
          {
            "id": "intro-desc",
            "file": "desc/intro.html",
            "start_ms": 0,
            "end_ms": 30000
          },
          {
            "id": "lesson-desc",
            "file": "desc/lesson.html",
            "start_ms": 30000,
            "end_ms": 90000
          },
          {
            "id": "outro-desc",
            "file": "desc/outro.html",
            "start_ms": 90000,
            "end_ms": 120000
          }
        ]
      }
    ]
  };
  
  fs.writeFileSync(
    path.join(sampleDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✓ Updated manifest.json');
}

function createFallbackContent() {
  // Use the previous generation logic as fallback
  console.log('Creating fallback content with generated files...');
  
  // Make sure we have the enhanced HTML and subtitles at least
  createEnhancedHtmlContent();
  createRealisticSubtitles();
  updateManifest();
  
  console.log('✓ Fallback content created');
}

// Run the download
downloadTestContent();