// react-konva@18.x reads ReactDOM.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentBatchConfig
// which was removed in React 19. This module must be imported BEFORE react-konva in the same webpack chunk.
;(function patchForKonva() {
  if (typeof window === 'undefined') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const RD = require('react-dom') as any
    const key = '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED'
    if (!RD[key]) {
      RD[key] = { ReactCurrentBatchConfig: { transition: null } }
    } else if (!RD[key].ReactCurrentBatchConfig) {
      RD[key].ReactCurrentBatchConfig = { transition: null }
    }
  } catch { /* ignore */ }
})()
export {}
