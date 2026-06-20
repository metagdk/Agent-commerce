const path = require('path');
const { createHandleRequest } = require('../lib/server-core');

const siteDir = path.join(__dirname, '..', 'site');

if (!process.env.FUJI_RPC) {
  process.env.FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
}

const handler = createHandleRequest(siteDir);

module.exports = function(req, res) {
  handler(req, res);
};
