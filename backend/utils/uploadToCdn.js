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

module.exports = { uploadToCdn };