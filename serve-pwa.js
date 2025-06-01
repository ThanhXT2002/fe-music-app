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

app.listen(PORT, () => {
  console.log(`🚀 PWA Server running at http://localhost:${PORT}`);
  console.log('📱 Open this URL in your browser to test PWA features');
  console.log('💡 Use Chrome DevTools > Application > Service Workers to inspect');
  console.log('🔧 Use Chrome DevTools > Lighthouse to test PWA score');
});
