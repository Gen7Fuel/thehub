import { sageApi } from './sage.api'

export const sageService = {
  exchangeToken<T>(code: string) {
    return sageApi.exchangeToken<T>(code, { actionContext: { source: 'sage.callback', action: 'create', resourceType: 'sage-session', message: 'Sage OAuth authorization code exchanged for an access token' } })
  },
}
