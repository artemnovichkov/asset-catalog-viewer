import lottie from 'lottie-web';
import { formatTime } from './utils.js';

let currentLottieAnimation = null;

// Initialize Lottie player for JSON content
export function initLottiePlayer(jsonContent) {
  if (currentLottieAnimation) {
    currentLottieAnimation.destroy();
    currentLottieAnimation = null;
  }

  const container = document.getElementById('lottieAnimation');
  const playBtn = document.getElementById('lottiePlayBtn');
  const progressSlider = document.getElementById('lottieProgress');
  const currentTimeEl = document.getElementById('lottieCurrentTime');
  const durationEl = document.getElementById('lottieDuration');
  const speedSelect = document.getElementById('lottieSpeed');
  const loopBtn = document.getElementById('lottieLoopBtn');

  if (!container) return;

  let animationData;
  try {
    animationData = JSON.parse(jsonContent);
  } catch (e) {
    console.error('Failed to parse Lottie JSON:', e);
    return;
  }

  const anim = lottie.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    animationData: animationData
  });

  currentLottieAnimation = anim;

  const frameRate = animationData.fr || 30;
  const totalFrames = anim.totalFrames;
  const durationSec = totalFrames / frameRate;

  durationEl.textContent = formatTime(durationSec);

  if (totalFrames > 1) {
    anim.addEventListener('enterFrame', () => {
      const currentFrame = anim.currentFrame;
      const progress = (currentFrame / totalFrames) * 100;
      progressSlider.value = progress;
      const currentSec = currentFrame / frameRate;
      currentTimeEl.textContent = formatTime(currentSec);
    });
  }

  let isPlaying = true;
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      anim.pause();
      playBtn.innerHTML = '<i class="codicon codicon-play"></i>';
    } else {
      anim.play();
      playBtn.innerHTML = '<i class="codicon codicon-debug-pause"></i>';
    }
    isPlaying = !isPlaying;
  });

  progressSlider.addEventListener('input', (e) => {
    const progress = parseFloat(e.target.value);
    const frame = (progress / 100) * totalFrames;
    anim.goToAndStop(frame, true);
    if (isPlaying) {
      anim.play();
    }
  });

  speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    anim.setSpeed(speed);
  });

  let isLooping = true;
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    anim.loop = isLooping;
    loopBtn.classList.toggle('active', isLooping);
    const icon = loopBtn.querySelector('i');
    if (isLooping) {
      icon.className = 'codicon codicon-sync';
    } else {
      icon.className = 'codicon codicon-sync-ignored';
    }
  });
}

// Initialize DotLottie player (.lottie files)
export function initDotLottiePlayer() {
  const player = document.getElementById('dotLottiePlayer');
  const playBtn = document.getElementById('lottiePlayBtn');
  const progressSlider = document.getElementById('lottieProgress');
  const currentTimeEl = document.getElementById('lottieCurrentTime');
  const durationEl = document.getElementById('lottieDuration');
  const speedSelect = document.getElementById('lottieSpeed');
  const loopBtn = document.getElementById('lottieLoopBtn');

  if (!player) return;

  let isPlaying = true;
  let isLooping = true;
  let totalFrames = 0;
  let frameRate = 30;

  player.addEventListener('ready', () => {
    const lottieInstance = player.getLottie();
    if (lottieInstance) {
      totalFrames = lottieInstance.totalFrames;
      frameRate = lottieInstance.frameRate || 30;
      const durationSec = totalFrames / frameRate;
      durationEl.textContent = formatTime(durationSec);
    }
  });

  player.addEventListener('frame', (e) => {
    const currentFrame = e.detail.frame;
    if (totalFrames > 1) {
      const progress = (currentFrame / totalFrames) * 100;
      progressSlider.value = progress;
      const currentSec = currentFrame / frameRate;
      currentTimeEl.textContent = formatTime(currentSec);
    }
  });

  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      player.pause();
      playBtn.innerHTML = '<i class="codicon codicon-play"></i>';
    } else {
      player.play();
      playBtn.innerHTML = '<i class="codicon codicon-debug-pause"></i>';
    }
    isPlaying = !isPlaying;
  });

  progressSlider.addEventListener('input', (e) => {
    const progress = parseFloat(e.target.value);
    const frame = (progress / 100) * totalFrames;
    player.seek(frame);
    if (!isPlaying) {
      player.pause();
    }
  });

  speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    player.setSpeed(speed);
  });

  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    player.setLooping(isLooping);
    loopBtn.classList.toggle('active', isLooping);
    const icon = loopBtn.querySelector('i');
    if (isLooping) {
      icon.className = 'codicon codicon-sync';
    } else {
      icon.className = 'codicon codicon-sync-ignored';
    }
  });
}
