const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ExcelJS = require("exceljs");

// Configuration
const DATASET_DIR = path.join(__dirname, "dataset"); // Root directory containing Processed, Regular, Blur
const TARGET_WIDTH = 1000; // Resize width to normalize scores across different cameras

/**
 * Calculates Laplacian Variance for a given image buffer.
 * Standard 3x3 Laplacian Kernel:
 * [  0,  1,  0 ]
 * [  1, -4,  1 ]
 * [  0,  1,  0 ]
 */
async function calculateLaplacianVariance(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .resize({ width: TARGET_WIDTH, fit: "inside", withoutEnlargement: false })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Image dimensions after initial max-width resize
    const width = info.width;
    const height = info.height;

    // Asymmetric Crop Bounding Box
    const startX = Math.floor(width * 0.15); // Crop 15% off Left
    const endX = Math.floor(width * 0.85); // Crop 15% off Right
    const startY = Math.floor(height * 0.05); // Crop only 5% off Top (preserves top-aligned content)
    const endY = Math.floor(height * (1.0 - 0.35)); // Crop 35% off Bottom (ignores empty lower space)

    const laplacianValues = [];

    // Perform 8-Neighbor Convolution over Asymmetric Center ROI
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const top = data[(y - 1) * width + x];
        const bottom = data[(y + 1) * width + x];
        const left = data[y * width + (x - 1)];
        const right = data[y * width + (x + 1)];
        const topLeft = data[(y - 1) * width + (x - 1)];
        const topRight = data[(y - 1) * width + (x + 1)];
        const bottomLeft = data[(y + 1) * width + (x - 1)];
        const bottomRight = data[(y + 1) * width + (x + 1)];
        const center = data[y * width + x];

        // 8-Neighbor Laplacian
        const laplacian =
          top +
          bottom +
          left +
          right +
          topLeft +
          topRight +
          bottomLeft +
          bottomRight -
          8 * center;
        laplacianValues.push(laplacian);
      }
    }

    const totalPixels = laplacianValues.length;
    const sum = laplacianValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / totalPixels;

    const variance =
      laplacianValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      totalPixels;

    return Math.round(variance * 100) / 100;
  } catch (err) {
    console.error(`Error processing file ${imagePath}:`, err.message);
    return null;
  }
}

/**
 * Calculates Interquartile Range (IQR) for Outlier detection per category.
 */
function getCategoryIQR(scores) {
  if (scores.length < 4) return { lowerBound: -Infinity, upperBound: Infinity };

  const sorted = [...scores].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  return {
    q1,
    q3,
    iqr,
    lowerBound: q1 - 1.5 * iqr,
    upperBound: q3 + 1.5 * iqr,
  };
}

/**
 * Main Runner
 */
async function run() {
  let hadError = false;

  try {
    console.log("Starting invoice blur analysis...");

    const categories = ["Processed", "Regular", "Blur"];
    const rawResults = [];
    let globalId = 1;

    // Step 1: Scan folders and process each image
    for (const category of categories) {
      const categoryFolder = path.join(DATASET_DIR, category);

      if (!fs.existsSync(categoryFolder)) {
        console.warn(
          `⚠️ Folder "${category}" not found at ${categoryFolder}, skipping.`,
        );
        continue;
      }

      const files = fs
        .readdirSync(categoryFolder)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
      console.log(`Processing ${files.length} images in "${category}"...`);

      for (const filename of files) {
        const filePath = path.join(categoryFolder, filename);
        const score = await calculateLaplacianVariance(filePath);

        if (score !== null) {
          rawResults.push({
            id: globalId++,
            filename,
            category,
            score,
            isOutlier: false,
          });
        }
      }
    }

    if (rawResults.length === 0) {
      throw new Error(
        "No valid images found to process. Please check dataset folder paths.",
      );
    }

    // Step 2: Outlier Detection using IQR per Category
    for (const category of categories) {
      const categoryItems = rawResults.filter((r) => r.category === category);
      const scores = categoryItems.map((r) => r.score);
      const { lowerBound, upperBound } = getCategoryIQR(scores);

      categoryItems.forEach((item) => {
        if (item.score < lowerBound || item.score > upperBound) {
          item.isOutlier = true;
        }
      });
    }

    // Step 3: Generate Excel Workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Detailed Invoice Scores
    const detailSheet = workbook.addWorksheet("Invoice Analysis");
    detailSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Filename", key: "filename", width: 25 },
      { header: "Initial Quality (Category)", key: "category", width: 25 },
      { header: "Laplacian Variance Score", key: "score", width: 25 },
      { header: "Is Outlier?", key: "isOutlier", width: 18 },
    ];

    rawResults.forEach((item) => {
      const row = detailSheet.addRow({
        id: item.id,
        filename: item.filename,
        category: item.category,
        score: item.score,
        isOutlier: item.isOutlier ? "YES (Outlier)" : "No",
      });

      if (item.isOutlier) {
        row.getCell("isOutlier").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFCCCC" }, // Light red highlight
        };
      }
    });

    // Sheet 2: Summary Averages & Statistics
    const summarySheet = workbook.addWorksheet("Category Summaries");
    summarySheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Total Samples", key: "count", width: 15 },
      { header: "Average Score", key: "avg", width: 20 },
      { header: "Min Score", key: "min", width: 15 },
      { header: "Max Score", key: "max", width: 15 },
      { header: "Outlier Count", key: "outliers", width: 15 },
    ];

    for (const category of categories) {
      const items = rawResults.filter((r) => r.category === category);
      if (items.length === 0) continue;

      const scores = items.map((r) => r.score);
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / scores.length) * 100) / 100;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const outlierCount = items.filter((r) => r.isOutlier).length;

      summarySheet.addRow({
        category,
        count: items.length,
        avg,
        min,
        max,
        outliers: outlierCount,
      });
    }

    const outputPath = path.join(
      __dirname,
      "invoice_blur_analysis_with_image_roi_revised.xlsx",
    );
    await workbook.xlsx.writeFile(outputPath);

    console.log(`\nAnalysis complete! File generated at: ${outputPath}`);
  } catch (err) {
    hadError = true;
    console.error("Analysis execution failed:", err);
  } finally {
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
