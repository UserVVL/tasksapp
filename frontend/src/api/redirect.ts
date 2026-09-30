let _redirect: (() => void) | null = null

export function setRedirectHandler(fn: () => void) {
  _redirect = fn
}

export function redirectToLogin() {
  if (_redirect) _redirect()
}
