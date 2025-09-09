const express = require('express');
const multer = require('multer');
const uuid = require('uuid');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());    //Aloows other websites to access the Express server. Specifically helping browsers to allow requests from frontend React to Backend Express.
app.use(express.json({ limit: '50mb' }));   // The limit of json payloads coming with incominh requests. By defualt is 100 kb.

/* Currently the data is being stored in the physical server at the Burlington Office.
The below code will store the incoming file to the provided file path at the physical server. */

const storage = multer.diskStorage({ 
  destination: (req, file, cb) => {
    cb(null, 'uploads/');   // Uploads is a folder which has been already created physically in the server machine.
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuid.v4();   // Generate unique ID for file
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);    // Save with unique ID
  },
});

const upload = multer({ storage: storage });    //Multer helps in multipart/form-data uploads when the uploads are coming from a form.

//Testing route /cdn/ for checking server's downtime

app.get('/cdn', (req, res) => { 
  res.send('Upload service running');
});

// Upload endpoint for multipart/form-data

app.post('/cdn/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });   //Handling missing upload data 

  const fileInfo = { filename: req.file.filename };
  res.json(fileInfo);  // Return file info with ID
});

// Upload endpoint for base64-encoded data

app.post('/cdn/upload-base64', (req, res) => {
  const { base64Data, fileName } = req.body;      //get the base64 data from the request

  if (!base64Data || !fileName) {
    return res.status(400).json({ error: 'Invalid request' });   //Handling missing upload data 
  }

  const uniqueSuffix = uuid.v4();     // Generate unique ID for file
  const fileExtension = path.extname(fileName);     
  const filePath = path.join(__dirname, 'uploads', `${uniqueSuffix}${fileExtension}`);      // Storing File path

  const base64String = base64Data.split(';base64,').pop();    // Remove the base64 prefix if present

  // Using write file system function to save the uploaded file to the server path

  fs.writeFile(filePath, base64String, { encoding: 'base64' }, (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to save file' });   //Handle http 500 error while saving
    }

    const fileInfo = { filename: `${uniqueSuffix}${fileExtension}` };
    res.json(fileInfo);  // Return file info with ID
  });
});

/* Download endpoint for accessing the server file via url and image id */

app.get('/cdn/download/:id', (req, res) => {
  const fileId = req.params.id;
  const filePath = path.join(__dirname, 'uploads', fileId);
  console.log('Serving file:', filePath);  // Debugging log
  res.sendFile(filePath);
});

const PORT = 5001;    //port at which the http server will be created
app.listen(PORT, () => console.log('Upload service running on port ' + PORT));  //creating http server at the above mentioned port and listening the to incomeing http requests.