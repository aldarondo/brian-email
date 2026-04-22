const API_KEY = process.env.MCP_API_KEY || null;

if (!API_KEY) {
  console.error('[WARN] MCP_API_KEY is not set — server is open to anyone on the network');
}

export function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const auth = req.headers['authorization'] ?? '';
  if (auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
