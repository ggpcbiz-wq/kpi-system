const { google } = require('googleapis');
const stream = require('stream');
require('dotenv').config(); 

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const auth = new google.auth.GoogleAuth({
  scopes: SCOPES,
});

const uploadToDrive = async (fileObject) => {
  try {
    const driveService = google.drive({ version: 'v3', auth });
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    const { data } = await driveService.files.create({
      media: {
        mimeType: fileObject.mimetype,
        body: bufferStream,
      },
      requestBody: {
        name: `${Date.now()}_${fileObject.originalname}`,
        parents: [FOLDER_ID],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true, 
    });

    
    await driveService.permissions.create({
      fileId: data.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true, 
    });

    return data.webViewLink; 
  } catch (error) {
    console.error('Google Drive Upload Error:', error);
    throw error;
  }
};

module.exports = { uploadToDrive };