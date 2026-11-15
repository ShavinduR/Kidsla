import { isAuthenticated, isConfigured } from './_lib/auth.js'
import { handle, send } from './_lib/http.js'

export default handle(['GET'], async (req, res) => {
  const configured = isConfigured()
  send(res, 200, { authenticated: configured ? await isAuthenticated(req) : false, configured })
})
