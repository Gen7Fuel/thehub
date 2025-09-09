const express = require('express');
const multer = require('multer');
const uuid = require('uuid');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase the limit if needed

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuid.v4();  // Generate unique ID for file
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);  // Save with unique ID
  },
});

const upload = multer({ storage: storage });

app.get('/cdn', (req, res) => {
  res.send('Upload service running');
});

// Upload endpoint for multipart/form-data
app.post('/cdn/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileInfo = { filename: req.file.filename };
  res.json(fileInfo);  // Return file info with ID
});

// Upload endpoint for base64-encoded data
app.post('/cdn/upload-base64', (req, res) => {
  const { base64Data, fileName } = req.body;

  if (!base64Data || !fileName) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const uniqueSuffix = uuid.v4();  // Generate unique ID for file
  const fileExtension = path.extname(fileName);
  const filePath = path.join(__dirname, 'uploads', `${uniqueSuffix}${fileExtension}`);

  // Remove the base64 prefix if present
  const base64String = base64Data.split(';base64,').pop();

  fs.writeFile(filePath, base64String, { encoding: 'base64' }, (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to save file' });
    }

    const fileInfo = { filename: `${uniqueSuffix}${fileExtension}` };
    res.json(fileInfo);  // Return file info with ID
  });
});

// Download endpoint
app.get('/cdn/download/:id', (req, res) => {
  const fileId = req.params.id;
  const filePath = path.join(__dirname, 'uploads', fileId);
  console.log('Serving file:', filePath);  // Debugging log
  res.sendFile(filePath);
});

const PORT = 5001;
app.listen(PORT, () => console.log('Upload service running on port ' + PORT));