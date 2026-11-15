import http from 'node:http'
import { MongoClient } from 'mongodb'
import { TEST_ENV } from '../playwright.config.js'

// A fake Resend API: records every email the app "sends", so tests can inspect them.
export default async function globalSetup() {
  const client = await new MongoClient(TEST_ENV.MONGODB_URI).connect()
  await client.db(TEST_ENV.MONGODB_DB).dropDatabase()
  await client.close()

  const emails = []
  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify(emails))
    }
    if (req.method === 'DELETE') {
      emails.length = 0
      return res.end('{}')
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      emails.push({ auth: req.headers.authorization, ...JSON.parse(body || '{}') })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: `email_${emails.length}` }))
    })
  })
  await new Promise((r) => server.listen(4999, '127.0.0.1', r))
  return async () => new Promise((r) => server.close(r))
}
