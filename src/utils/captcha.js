// utils/captcha.js
import Canvas from "canvas";

const DEFAULTS = {
  length: 5,
  width: 300,
  height: 100,
};

function randomChar() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude ambiguous chars
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

export function createRandomCaptchaText(len = DEFAULTS.length) {
  let s = "";
  for (let i = 0; i < len; i++) s += randomChar();
  return s;
}

function getRandomColorForText() {
  const colors = ["#eab308", "#06b6d4", "#ef4444", "#a78bfa", "#34d399"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function generateCaptchaImageBuffer(
  text,
  width = DEFAULTS.width,
  height = DEFAULTS.height
) {
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#0f172a");
  bgGradient.addColorStop(1, "#1e293b");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // fewer noise circles
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)},${Math.floor(
      Math.random() * 255
    )},${Math.floor(Math.random() * 255)},0.06)`;
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    const r = Math.random() * 15;
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // draw each character with **gentle** distortions
  const charSpacing = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const fontSize = 42 + Math.floor(Math.random() * 10);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = getRandomColorForText();

    const x = charSpacing * (i + 1) + (Math.random() * 4 - 2);
    const y = height / 2 + (Math.random() * 8 - 4);

    ctx.save();
    ctx.translate(x, y);

    // smaller rotation (±10° instead of ±20°)
    const angle = (Math.random() * 20 - 10) * (Math.PI / 180);
    ctx.rotate(angle);

    // mild skew
    const skewX = Math.random() * 0.2 - 0.1;
    const skewY = Math.random() * 0.2 - 0.1;
    ctx.transform(1, skewY, skewX, 1, 0, 0);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(ch, -fontSize / 2, 0);
    ctx.fillText(ch, -fontSize / 2, 0);

    ctx.restore();
  }

  // fewer interference curves
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width,
      Math.random() * height,
      Math.random() * width,
      Math.random() * height,
      Math.random() * width,
      Math.random() * height
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 255)},${Math.floor(
      Math.random() * 255
    )},${Math.floor(Math.random() * 255)},0.25)`;
    ctx.stroke();
  }

  // fewer dots
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)},${Math.floor(
      Math.random() * 255
    )},${Math.floor(Math.random() * 255)},0.2)`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
  }

  // === Softer WAVE DISTORTION ===
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const tempCanvas = Canvas.createCanvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");
  const tempImg = tempCtx.createImageData(width, height);
  const dst = tempImg.data;

  const amplitude = 2 + Math.random() * 2; // was 5–10 → now 2–4
  const frequency = 0.02 + Math.random() * 0.02; // was 0.05–0.1 → now 0.02–0.04

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offsetX = Math.floor(amplitude * Math.sin(y * frequency));
      const offsetY = Math.floor(amplitude * Math.cos(x * frequency));

      const srcX = Math.min(width - 1, Math.max(0, x + offsetX));
      const srcY = Math.min(height - 1, Math.max(0, y + offsetY));

      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * width + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  ctx.putImageData(tempImg, 0, 0);

  return canvas.toBuffer();
}