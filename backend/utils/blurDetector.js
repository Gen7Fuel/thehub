// utils/blurDetector.js
const sharp = require("sharp");

const TARGET_WIDTH = 1000;
const BLUR_THRESHOLD = 850;

/**
 * Calculates Laplacian Variance for a given image Buffer.
 * Uses 8-Neighbor Convolution over an asymmetric center ROI.
 */
async function calculateLaplacianVariance(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize({ width: TARGET_WIDTH, fit: "inside", withoutEnlargement: false })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Asymmetric Crop Bounding Box (Top-heavy focus)
    const startX = Math.floor(width * 0.15);
    const endX = Math.floor(width * 0.85);
    const startY = Math.floor(height * 0.05);
    const endY = Math.floor(height * (1.0 - 0.35));

    const laplacianValues = [];

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const top        = data[(y - 1) * width + x];
        const bottom     = data[(y + 1) * width + x];
        const left       = data[y * width + (x - 1)];
        const right      = data[y * width + (x + 1)];
        const topLeft    = data[(y - 1) * width + (x - 1)];
        const topRight   = data[(y - 1) * width + (x + 1)];
        const bottomLeft = data[(y + 1) * width + (x - 1)];
        const bottomRight= data[(y + 1) * width + (x + 1)];
        const center     = data[y * width + x];

        const laplacian =
          top + bottom + left + right +
          topLeft + topRight + bottomLeft + bottomRight - 8 * center;

        laplacianValues.push(laplacian);
      }
    }

    const totalPixels = laplacianValues.length;
    if (totalPixels === 0) return { score: 0, isFlaggedBlur: false };

    const sum = laplacianValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / totalPixels;

    const variance =
      laplacianValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      totalPixels;

    const score = Math.round(variance * 100) / 100;

    return {
      score,
      isFlaggedBlur: score < BLUR_THRESHOLD,
    };
  } catch (err) {
    console.error("❌ [Blur Detector] Error calculating variance score:", err.message);
    return { score: null, isFlaggedBlur: false };
  }
}

module.exports = { calculateLaplacianVariance, BLUR_THRESHOLD };