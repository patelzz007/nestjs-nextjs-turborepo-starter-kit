const http = require('http');

http.get('http://localhost:3001/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("HTML length:", data.length);
    // Let's check sections in HTML
    const ids = ['demo-breadcrumbs', 'demo-table', 'demo-accordion', 'demo-combobox', 'demo-select', 'demo-alerts', 'demo-toasts'];
    for (const id of ids) {
      const idx = data.indexOf(`id="${id}"`);
      console.log(`id="${id}":`, idx !== -1 ? "Found" : "Not found");
    }
  });
}).on('error', err => console.error(err));
