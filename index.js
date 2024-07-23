const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 4000;

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files (e.g., index.html)
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Configure Google Cloud Storage
const storage = new Storage({ keyFilename: 'key.json' });
const bucketName = 'cg-project-bucket';
const bucket = storage.bucket(bucketName);

// Upload file to Google Cloud Storage
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, path: tempPath } = req.file;
    const destination = `uploads/${originalname}`;

    await bucket.upload(tempPath, { destination });
    fs.unlinkSync(tempPath);

    res.json({ message: 'File uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Serve the list of uploaded images
app.get('/images', async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ prefix: 'uploads/' });
    const images = files.map(file => ({
      name: file.name.split('/').pop(),
      url: `https://storage.googleapis.com/${bucketName}/${file.name}`
    }));
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve images' });
  }
});

// Serve individual images
app.get('/images/:filename', (req, res) => {
  const filename = req.params.filename;
  const file = bucket.file(`uploads/${filename}`);
  file.createReadStream()
    .on('error', (err) => {
      res.status(404).json({ error: 'File not found' });
    })
    .pipe(res);
});

// Download image
app.get('/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  const tempPath = path.join(__dirname, 'downloads', filename);

  try {
    const file = bucket.file(`uploads/${filename}`);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const options = {
      destination: tempPath,
    };

    await file.download(options);

    res.download(tempPath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to download file' });
      } else {
        fs.unlinkSync(tempPath);
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete image
app.delete('/delete/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    await bucket.file(`uploads/${filename}`).delete();
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Panorama generation and download
app.post('/generate-panorama', async (req, res) => {
  const panoramaFilename = 'panorama.jpg';
  const panoramaPath = path.join(uploadsDir, panoramaFilename);

  try {
    // Run the panorama stitching command
    exec(`python stitch.py ${uploadsDir} ${panoramaPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing stitch.py: ${stderr}`);
        return res.status(500).json({ error: 'Failed to generate panorama' });
      }

      // Upload the generated panorama to Google Cloud Storage
      bucket.upload(panoramaPath, { destination: `panorama/${panoramaFilename}` })
        .then(() => {
          fs.unlinkSync(panoramaPath);
          const panoramaUrl = `https://storage.googleapis.com/${bucketName}/panorama/${panoramaFilename}`;
          res.json({ message: 'Panorama generated successfully', panoramaUrl });
        })
        .catch(err => {
          console.error(`Error uploading panorama: ${err}`);
          res.status(500).json({ error: 'Failed to upload panorama' });
        });
    });
  } catch (error) {
    console.error(`Error generating panorama: ${error}`);
    res.status(500).json({ error: 'Failed to generate panorama' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});