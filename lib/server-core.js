const { ethers } = require('ethers');

const RPC_URL = process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
const COMMERCE_ADDR = process.env.COMMERCE || '0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171';
const ONECLICK_ADDR = process.env.ONECLICK || '0x97877Cd8a32A65fEEF054cf9edb07C042e51b942';
const USDC_ADDR = process.env.USDC || '0x3B81af965F10E11Eb3d0CD760D493b753DA393A9';
const IDENTITY_ADDR = process.env.IDENTITY || '0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4';
const REPUTATION_ADDR = process.env.REPUTATION || '0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f';

const PRICES = {
  '/api/market-data':  { amount: ethers.parseUnits('1', 6), description: 'Market data feed' },
  '/api/analysis':     { amount: ethers.parseUnits('5', 6), description: 'DeFi analysis report' },
  '/api/sentiment':    { amount: ethers.parseUnits('3', 6), description: 'Sentiment analysis' },
  '/api/premium-data': { amount: ethers.parseUnits('10', 6), description: 'Premium data bundle' },
};

const FREE_PATHS = [
  '/health', '/api/products', '/api/tip', '/api/identity',
  '/api/reputation', '/api/ai-pricing', '/api/verify-payment',
];

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

const payments = new Map();

const provider = new ethers.JsonRpcProvider(RPC_URL);
const commerce = new ethers.Contract(COMMERCE_ADDR, [
  'function getTask(uint256) view returns (bytes32,bytes32,uint256,string memory,uint8,uint256)',
  'function getTotalTasks() view returns (uint256)',
  'function tasks(bytes32) view returns (bytes32,bytes32,uint256,string memory,uint8,uint256)',
], provider);
const usdc = new ethers.Contract(USDC_ADDR, [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
], provider);
const identity = new ethers.Contract(IDENTITY_ADDR, [
  'function isRegistered(bytes32) view returns (bool)',
  'function getAgent(bytes32) view returns (address,string,string,string,bool)',
  'function agentCount() view returns (uint256)',
], provider);
const reputation = new ethers.Contract(REPUTATION_ADDR, [
  'function getReputation(bytes32) view returns (uint256,uint256,uint256)',
], provider);

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'x-payment-tx,x-resource-id,content-type',
    'Access-Control-Expose-Headers': 'x-payment-required,x-payment-amount,x-payment-token,x-payment-chain,x-resource-id',
  });
  res.end(JSON.stringify(data));
}

async function verifyPayment(txHash, expectedAmount, resourceId) {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) return false;
    const txTo = (tx.to || '').toLowerCase();
    if (txTo !== COMMERCE_ADDR.toLowerCase() && txTo !== ONECLICK_ADDR.toLowerCase()) return false;
    payments.set(resourceId, { paid: true, txHash, blockNumber: receipt.blockNumber, amount: expectedAmount });
    return true;
  } catch (e) {
    return false;
  }
}

function generateMarketData() {
  return {
    timestamp: Date.now(),
    prices: {
      ETH:  { usd: +(2845 + Math.random() * 50).toFixed(2), change24h: +((Math.random() - 0.5) * 6).toFixed(1) },
      BTC:  { usd: +(68450 + Math.random() * 200).toFixed(2), change24h: +((Math.random() - 0.5) * 4).toFixed(1) },
      AVAX: { usd: +(38.45 + Math.random() * 2).toFixed(2), change24h: +((Math.random() - 0.5) * 8).toFixed(1) },
      LINK: { usd: +(14.20 + Math.random() * 1).toFixed(2), change24h: +((Math.random() - 0.5) * 5).toFixed(1) },
    },
    defi: {
      totalTvl: 89400000000 + Math.random() * 1e9,
      topPool: 'Aave USDC/DAI',
      apyAvg: +(4.2 + Math.random() * 2).toFixed(1),
    },
  };
}

function generateAnalysis() {
  return {
    timestamp: Date.now(),
    marketRegime: Math.random() > 0.6 ? 'risk-on' : 'neutral',
    signals: [
      { pair: 'ETH/BTC', signal: Math.random() > 0.5 ? 'bullish' : 'bearish', confidence: Math.floor(Math.random() * 40 + 60) },
      { pair: 'AVAX/USD', signal: Math.random() > 0.5 ? 'bullish' : 'bearish', confidence: Math.floor(Math.random() * 40 + 60) },
    ],
    recommendation: Math.random() > 0.5 ? 'accumulate' : 'hold',
    insights: 'Market showing signs of consolidation after recent move. Watch for volume confirmation.',
  };
}

const apiRoutes = {};

apiRoutes['/health'] = function() {
  return { status: 'ok', chain: 'avalanche-fuji', contract: COMMERCE_ADDR, served: payments.size };
};

apiRoutes['/api/products'] = function() {
  return {
    name: 'Agent Commerce API',
    version: '1.0.0',
    endpoints: Object.entries(PRICES).map(function(e) {
      return { path: e[0], price: ethers.formatUnits(e[1].amount, 6), description: e[1].description, token: 'USDC' };
    }),
  };
};

apiRoutes['/api/market-data'] = generateMarketData;
apiRoutes['/api/analysis'] = generateAnalysis;
apiRoutes['/api/sentiment'] = function() {
  return {
    timestamp: Date.now(),
    overall: Math.random() > 0.5 ? 'positive' : 'neutral',
    score: Math.floor(Math.random() * 40 + 30),
    mentions: Math.floor(Math.random() * 1000 + 500),
    top: Math.random() > 0.5 ? 'BTC' : 'ETH',
  };
};
apiRoutes['/api/premium-data'] = function() {
  return {
    timestamp: Date.now(),
    orderFlow: { buyPressure: +(Math.random() * 100).toFixed(0), sellPressure: +(Math.random() * 100).toFixed(0) },
    whaleAlerts: Array.from({ length: 3 }, function() {
      return {
        amount: Math.floor(Math.random() * 10000 + 1000),
        token: ['USDC', 'USDT', 'WETH'][Math.floor(Math.random() * 3)],
        action: Math.random() > 0.5 ? 'buy' : 'sell',
      };
    }),
    liquidationLevels: {
      btc: { long: Math.floor(Math.random() * 50000 + 60000), short: Math.floor(Math.random() * 30000 + 40000) },
      eth: { long: Math.floor(Math.random() * 2000 + 2500), short: Math.floor(Math.random() * 1000 + 1500) },
    },
  };
};

apiRoutes['/api/verify-payment'] = async function(req, body) {
  var params = JSON.parse(body || '{}');
  if (!params.txHash || !params.resourceId) return { error: 'Missing txHash or resourceId' };
  if (payments.has(params.resourceId) && payments.get(params.resourceId).paid) {
    return { verified: true, resourceId: params.resourceId, paid: true };
  }
  var amt = params.expectedAmount ? ethers.parseUnits(String(params.expectedAmount), 6) : ethers.parseUnits('1', 6);
  var verified = await verifyPayment(params.txHash, amt, params.resourceId);
  return { verified: verified, resourceId: params.resourceId, paid: verified };
};

apiRoutes['/api/tip'] = async function(req, body) {
  var params = JSON.parse(body || '{}');
  if (!params.agentId) return { error: 'Missing agentId' };
  if (!params.amount) return { error: 'Missing amount (USDC)' };
  var agentBytes = params.agentId.startsWith('0x') ? params.agentId : ethers.id(params.agentId);
  var registered = await identity.isRegistered(agentBytes).catch(function() { return false; });
  if (!registered) {
    return { error: 'Agent not registered on ERC-8004. Tips require verified identity.', code: 'UNVERIFIED_IDENTITY' };
  }
  var agent = await identity.getAgent(agentBytes);
  var repData = await reputation.getReputation(agentBytes).catch(function() { return [0n, 0n, 0n]; });
  var paid = false;
  if (params.txHash) {
    paid = await verifyPayment(params.txHash, ethers.parseUnits(String(params.amount), 6), 'tip-' + agentBytes);
  }
  return {
    agent: agent[1], agentType: agent[2], owner: agent[0],
    reputation: Number(repData[2]), identityVerified: true,
    tipAmount: params.amount, token: 'USDC', chain: 'Avalanche Fuji (43113)', paid: paid,
    instructions: !paid ? ['Send ' + params.amount + ' USDC to ' + agent[1] + ' via AgentCommerce contract'] : [],
    message: paid ? 'Tip of ' + params.amount + ' USDC sent to ' + agent[1] + '!' : 'Agent verified. Send payment to complete tip.',
  };
};

apiRoutes['/api/identity'] = async function(req, body, url) {
  var agentId = url.searchParams.get('agentId');
  if (!agentId) return { error: 'Provide ?agentId=<bytes32|name>' };
  var agentBytes = agentId.startsWith('0x') ? agentId : ethers.id(agentId);
  var registered = await identity.isRegistered(agentBytes).catch(function() { return false; });
  if (!registered) return { registered: false, error: 'Agent not found on ERC-8004' };
  var agent = await identity.getAgent(agentBytes);
  var repData = await reputation.getReputation(agentBytes).catch(function() { return [0n, 0n, 0n]; });
  return {
    registered: true, standard: 'ERC-8004', agentId: agentBytes,
    name: agent[1], type: agent[2], owner: agent[0],
    reputation: { score: Number(repData[2]), count: Number(repData[1]) },
  };
};

apiRoutes['/api/reputation'] = async function(req, body, url) {
  var agentId = url.searchParams.get('agentId');
  if (!agentId) return { error: 'Provide ?agentId=<bytes32|name>' };
  var agentBytes = agentId.startsWith('0x') ? agentId : ethers.id(agentId);
  var registered = await identity.isRegistered(agentBytes).catch(function() { return false; });
  if (!registered) return { registered: false };
  var repData = await reputation.getReputation(agentBytes).catch(function() { return [0n, 0n, 0n]; });
  return { registered: true, score: Number(repData[2]), count: Number(repData[1]), percentile: '\u2014' };
};

apiRoutes['/api/ai-pricing'] = async function(req, body, url) {
  var callerId = url.searchParams.get('caller');
  var basePrice = ethers.parseUnits('5', 6);
  var multiplier = 1.0;
  var reason = 'new or unverified agent';
  if (callerId) {
    var agentBytes = callerId.startsWith('0x') ? callerId : ethers.id(callerId);
    var registered = await identity.isRegistered(agentBytes).catch(function() { return false; });
    if (registered) {
      var repData = await reputation.getReputation(agentBytes).catch(function() { return [0n, 0n, 0n]; });
      var score = Number(repData[2]);
      if (score >= 80) { multiplier = 0.7; reason = 'high reputation (' + score + '/100) \u2014 loyalty discount'; }
      else if (score >= 50) { multiplier = 0.85; reason = 'good reputation (' + score + '/100) \u2014 standard rate'; }
      else if (score >= 20) { multiplier = 1.0; reason = 'low reputation (' + score + '/100) \u2014 standard rate'; }
      else { multiplier = 1.25; reason = 'very low reputation (' + score + '/100) \u2014 risk premium'; }
    }
  }
  var adjustedPrice = basePrice * BigInt(Math.floor(multiplier * 100)) / 100n;
  return {
    basePrice: ethers.formatUnits(basePrice, 6), adjustedPrice: ethers.formatUnits(adjustedPrice, 6),
    multiplier: multiplier, reason: reason, token: 'USDC',
    policy: 'Reputation-aware pricing: high-rep agents pay less, unknown agents pay standard, low-rep agents pay a risk premium.',
  };
};

function collectBody(req, cb) {
  var data = '';
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', function() { cb(data); });
}

function send402(res, pathname, priceConfig, resourceId) {
  json(res, 402, {
    error: 'Payment Required',
    message: 'This endpoint requires payment. Send ' + ethers.formatUnits(priceConfig.amount, 6) + ' USDC via AgentCommerce contract.',
    payment: {
      resourceId: resourceId,
      amount: priceConfig.amount.toString(),
      amountHuman: ethers.formatUnits(priceConfig.amount, 6),
      token: 'USDC',
      tokenAddress: USDC_ADDR,
      chain: 'Avalanche Fuji (43113)',
      chainId: 43113,
      contract: COMMERCE_ADDR,
      description: priceConfig.description,
      instructions: [
        '1. Call commerce.payAndAssign(leadAgentId, specialistAgentId, amount) on AgentCommerce contract',
        '2. OR send USDC directly and include tx hash in X-Payment-Tx header',
        '3. Retry this request with X-Payment-Tx: <txhash> and X-Resource-Id: ' + resourceId,
      ],
    },
  });
}

function createHandleRequest(siteDir) {
  return function handleRequest(req, res) {
    var url = new URL(req.url, 'http://localhost');
    var pathname = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-payment-tx,x-resource-id,content-type',
        'Access-Control-Expose-Headers': 'x-payment-required,x-payment-amount,x-payment-token,x-payment-chain,x-resource-id',
      });
      res.end();
      return;
    }

    if (pathname.indexOf('/api/') === 0 || pathname === '/health') {
      var routeHandler = apiRoutes[pathname];
      if (!routeHandler) {
        json(res, 404, { error: 'Not found', available: Object.keys(apiRoutes) });
        return;
      }

      var priceConfig = PRICES[pathname];

      if (FREE_PATHS.indexOf(pathname) >= 0) {
        collectBody(req, function(body) {
          var result = routeHandler(req, body, url);
          if (result && typeof result.then === 'function') {
            result.then(function(r) { json(res, 200, r); });
          } else {
            json(res, 200, result);
          }
        });
        return;
      }

      var paymentTx = req.headers['x-payment-tx'];
      var resourceId = req.headers['x-resource-id'] || ethers.id(pathname + Date.now());

      if (paymentTx) {
        verifyPayment(paymentTx, priceConfig.amount, resourceId).then(function(verified) {
          if (verified) {
            var result = typeof routeHandler === 'function' ? routeHandler() : routeHandler;
            json(res, 200, Object.assign({}, result, { _payment: { resourceId: resourceId, txHash: paymentTx, paid: true } }));
          } else {
            send402(res, pathname, priceConfig, resourceId);
          }
        });
        return;
      }

      if (payments.has(resourceId) && payments.get(resourceId).paid) {
        var result = typeof routeHandler === 'function' ? routeHandler() : routeHandler;
        json(res, 200, Object.assign({}, result, { _payment: { resourceId: resourceId, paid: true } }));
        return;
      }

      send402(res, pathname, priceConfig, resourceId);
      return;
    }

    if (!siteDir) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    var fs = require('fs');
    var path = require('path');
    var requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
    var fullPath = path.resolve(siteDir, requestedPath);

    if (fullPath.indexOf(siteDir) !== 0) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    try {
      var content = fs.readFileSync(fullPath);
      var ext = path.extname(fullPath).toLowerCase();
      var contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  };
}

module.exports = {
  createHandleRequest,
  PRICES,
  COMMERCE_ADDR,
  WEB_PORT: null,
};
