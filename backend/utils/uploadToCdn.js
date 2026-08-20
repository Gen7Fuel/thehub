async function uploadToCdn(fileBuffer, originalName) {
  try {
    const formData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: "image/png" });
    formData.append("file", fileBlob, originalName);

    const response = await fetch("http://cdn:5001/cdn/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`CDN server dropped connection with status: ${response.status}`);
    }

    const data = await response.json();
    return `https://app.gen7fuel.com/cdn/download/${data.filename}`;
  } catch (error) {
    console.error("❌ Secondary Pipeline Error: Failed uploading image asset to CDN:", error);
    return null;
  }
}

/**
 * Fetches an image asset from the internal CDN container and returns it as a Buffer.
 * @param {string} filename - The target filename/ID stored in CDN.
 * @returns {Promise<{ filename: string, content: Buffer, contentType: string } | null>}
 */
async function downloadFromCdn(filename) {
  if (!filename) return null;

  try {
    const response = await fetch(`http://cdn:5001/cdn/download/${filename}`);

    if (!response.ok) {
      throw new Error(`CDN download failed with status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/png";

    return {
      filename,
      content: buffer,
      contentType,
    };
  } catch (error) {
    console.error(`❌ CDN Download Error: Failed retrieving asset [${filename}]:`, error);
    return null;
  }
}

module.exports = { 
  uploadToCdn,
  downloadFromCdn 
};