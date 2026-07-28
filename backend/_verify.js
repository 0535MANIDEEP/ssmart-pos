process.env.PORT = '4000';
require('./src/server.js');

setTimeout(async () => {
  const http = require('http');

  function post(path, body, cookie = '') {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({ hostname: '127.0.0.1', port: 4000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, Cookie: cookie } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let newCookie = cookie;
          if (setCookie) for (const sc of setCookie) newCookie = sc.split(';')[0];
          try { resolve({ data: JSON.parse(d), cookie: newCookie, status: res.statusCode }); } catch { resolve({ data: d, cookie: newCookie, status: res.statusCode }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  function get(path, cookie) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 4000, path, method: 'GET', headers: { Cookie: cookie } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve({ data: JSON.parse(d), status: res.statusCode }); } catch { resolve({ data: d, status: res.statusCode }); } });
      });
      req.on('error', reject);
      req.end();
    });
  }

  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      const result = await fn();
      console.log(`  ✓ ${name}${result ? ' — ' + result : ''}`);
      passed++;
      return true;
    } catch (err) {
      console.log(`  ✗ ${name} — ${err.message}`);
      failed++;
      return false;
    }
  }

  // Login
  const login = await post('/api/auth/login', { email: 'test@test.com', password: 'test12345' });
  const cookie = login.cookie;
  if (!cookie) { console.log('FATAL: Cannot login'); process.exit(1); }
  console.log('Logged in\n');

  console.log('Accounting Endpoints:');
  await test('trial-balance', async () => {
    const r = await get('/api/accounting/trial-balance', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} entries`;
  });
  await test('profit-loss', async () => {
    const r = await get('/api/accounting/profit-loss', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `income=${r.data.totalIncome}`;
  });
  await test('balance-sheet', async () => {
    const r = await get('/api/accounting/balance-sheet', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `assets=${r.data.totalAssets}`;
  });
  await test('cash-flow', async () => {
    const r = await get('/api/accounting/cash-flow', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return 'ok';
  });
  await test('receivables', async () => {
    const r = await get('/api/accounting/receivables', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} entries`;
  });
  await test('payables', async () => {
    const r = await get('/api/accounting/payables', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} entries`;
  });
  await test('groups', async () => {
    const r = await get('/api/accounting/groups', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} root groups`;
  });
  await test('ledgers', async () => {
    const r = await get('/api/accounting/ledgers', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} ledgers`;
  });
  await test('journals', async () => {
    const r = await get('/api/accounting/journals', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} journals`;
  });
  await test('cost-centers', async () => {
    const r = await get('/api/accounting/cost-centers', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} centers`;
  });
  await test('financial-years', async () => {
    const r = await get('/api/accounting/financial-years', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} years`;
  });
  await test('migrate/log', async () => {
    const r = await get('/api/migrate/log', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} logs`;
  });

  console.log('\nPOS Endpoints:');
  await test('products', async () => {
    const r = await get('/api/products', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} products`;
  });
  await test('invoices', async () => {
    const r = await get('/api/invoices', cookie);
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return `${r.data.length} invoices`;
  });

  console.log('\nE2E — Sale + Auto-Journal:');
  await test('checkout → journal → trial-balance', async () => {
    const products = await get('/api/products', cookie);
    const product = products.data[0];
    if (!product) throw new Error('No products');

    const sale = await post('/api/invoices', {
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountPaid: 100,
      customerName: 'Test',
      customerPhone: '9999999999',
    }, cookie);
    if (sale.status !== 201) throw new Error(`Checkout ${sale.status}: ${JSON.stringify(sale.data)}`);

    await new Promise(r => setTimeout(r, 500));

    const tb = await get('/api/accounting/trial-balance', cookie);
    if (tb.data.length < 4) throw new Error(`Expected 4+ TB entries, got ${tb.data.length}`);

    const pl = await get('/api/accounting/profit-loss', cookie);
    if (pl.data.totalIncome <= 0) throw new Error(`Income should be > 0, got ${pl.data.totalIncome}`);

    return `${sale.data.invoiceNumber} → ${tb.data.length} TB entries, income=${pl.data.totalIncome}`;
  });

  console.log(`\n═══════════════════════════════════════`);
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
}, 2000);
