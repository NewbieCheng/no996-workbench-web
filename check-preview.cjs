const http = require('http');

setTimeout(() => {
  http.get('http://127.0.0.1:8897', (res) => {
    console.log('HTTP Status:', res.statusCode);
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      console.log('Title included:', data.includes('<title>') || data.includes('html'));
      console.log('Length:', data.length);
    });
  }).on('error', (e) => {
    console.error('Error:', e.message);
  });
}, 1000);
