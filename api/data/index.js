const { BlobServiceClient } = require('@azure/storage-blob');

const CONN  = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONT  = 'dashboard';
const BNAME = 'handover_data.json';

module.exports = async function (context, req) {
  if (!CONN) {
    context.res = { status: 500, body: 'AZURE_STORAGE_CONNECTION_STRING not set' };
    return;
  }

  const container = BlobServiceClient
    .fromConnectionString(CONN)
    .getContainerClient(CONT);

  await container.createIfNotExists();

  const blob = container.getBlockBlobClient(BNAME);

  // ── GET — return stored JSON ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const dl = await blob.download(0);
      const chunks = [];
      for await (const chunk of dl.readableStreamBody) chunks.push(chunk);
      context.res = {
        status: 200,
        body: Buffer.concat(chunks).toString('utf8'),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      };
    } catch (e) {
      // blob doesn't exist yet — return empty object
      context.res = {
        status: 200,
        body: '{}',
        headers: { 'Content-Type': 'application/json' }
      };
    }
    return;
  }

  // ── POST — overwrite stored JSON ─────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.rawBody || '{}';
      const buf  = Buffer.from(body, 'utf8');
      await blob.upload(buf, buf.length, {
        overwrite: true,
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
      context.res = {
        status: 200,
        body: 'saved',
        headers: { 'Access-Control-Allow-Origin': '*' }
      };
    } catch (e) {
      context.res = { status: 500, body: 'Save failed: ' + e.message };
    }
    return;
  }

  context.res = { status: 405, body: 'Method not allowed' };
};
