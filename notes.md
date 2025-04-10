# Audio Playback Helper (Safe & Efficient)

// Shared AudioContext

let sharedAudioContext;

// Create or reuse the shared AudioContext

function getAudioContext() {
if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
sharedAudioContext = new AudioContext();
}
return sharedAudioContext;
}

// Safe audio play function

async function audioPlay(url) {
try {
const context = getAudioContext();

        // Fetch and decode audio
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);

        // Create and play source
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start();
    } catch (err) {
        console.warn('Audio playback failed:', err);
    }

}

// OPTIONAL: Unlock audio on first user interaction (required on mobile)

document.addEventListener('click', () => {
const ctx = getAudioContext();
if (ctx.state === 'suspended') {
ctx.resume();
}
});

# Usage Example

// Play a sound

audioPlay('assets/sfx/player_hit.mp3');

Why does this work?

-   Only one AudioContext is created and reused (prevents overload)
-   Works across desktop and mobile
-   Handles async loading safely
-   Optional interaction unlocks audio if the browser blocks autoplay

You can now drop this into any HTML5/JS game project without worrying about audio crashing after 60 seconds.
You can even turn this into an ES module or preload audio files for faster playback.
