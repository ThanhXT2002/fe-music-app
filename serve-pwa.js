const express = require('express');
const path = require('path');
const app = express();
const PORT = 8080;

// Serve static files from www directory
app.use(express.static(path.join(__dirname, 'www')));

// Handle Angular routing - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});


