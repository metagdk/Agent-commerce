const http = require('http');
const path = require('path');
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const { createHandleRequest, PRICES, COMMERCE_ADDR } = require('./lib/server-core');

const WEB_PORT = 8080;
const SITE_DIR = path.join(__dirname, 'site');
const handleRequest = createHandleRequest(SITE_DIR);

var server = http.createServer(handleRequest);
server.listen(WEB_PORT, function() {
  var endpoints = Object.keys(PRICES).map(function(p) {
    return '  ' + p + ': ' + require('ethers').formatUnits(PRICES[p].amount, 6) + ' USDC';
  });
  console.log('');
  console.log('Agent Commerce Server');
  console.log('  Web:     http://localhost:' + WEB_PORT + '/');
  console.log('  x402:    http://localhost:' + WEB_PORT + '/api/...');
  console.log('  Chain:   Avalanche Fuji (43113)');
  console.log('  Contract:' + COMMERCE_ADDR);
  console.log('');
  console.log('x402 Endpoints:');
  endpoints.forEach(function(e) { console.log(e); });
  console.log('');
});
