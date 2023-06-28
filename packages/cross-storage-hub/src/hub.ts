import { CrossStorageAction, CrossStorageHubOptions, CrossStoragePermission, CrossStorageRequest } from "./types.js";

const EVENT_UNAVAILABLE = 'cross-storage:unavailable'
const EVENT_READY       = 'cross-storage:ready'
const EVENT_POLL        = 'cross-storage:poll'
const EVENT_CHANGE      = 'cross-storage:change'

const allowedMethods = new Set([
  CrossStorageAction.SET,
  CrossStorageAction.GET,
  CrossStorageAction.DEL,
  CrossStorageAction.GET_KEYS,
  CrossStorageAction.CLEAR,
])


const storage = window.localStorage

let available = true;

try {
  if (!storage) available = false
} catch (e) {
  available = false
}

export default class CrossStorageHub {

  private static _instance: CrossStorageHub

  public static get instance() {
    if (!this._instance) {
      this._instance = new CrossStorageHub()
    }
    return this._instance
  }

  public static init = (options: CrossStorageHubOptions) => {
    return CrossStorageHub.instance._init(options.permissions, options.watch)
  }

  /**
   * Whether or not the hub is available.
   */
  public available = true

  /**
   * The permissions that have been set for the hub.
   */
  public permissions: CrossStoragePermission[] = []

  /**
   * The keys to watch for changes
   */
  public watchKeys: string[] | boolean = false

  constructor() {
    this.available = available
  }

  _init(permissions: CrossStoragePermission[], keys?: string[] | boolean) {
    if (!this.available) {
      try {
        window.parent.postMessage(EVENT_UNAVAILABLE, '*')
        return
      } catch (e) {
        return
      }
    }

    this.permissions = permissions

    window.addEventListener('message', this._onListener, false)
    window.parent.postMessage(EVENT_READY, '*')

    if (keys) {
      this.watchKeys = keys
      window.addEventListener('storage', this._onStorage, false)
    }

    return this
  }

  _onListener = (message: MessageEvent) => {
    // postMessage returns the string "null" as the origin for "file://"
    const origin = (message.origin === 'null') ? 'file://' : message.origin

    // Handle polling for a ready message
    if (message.data === EVENT_POLL) {
      window.parent.postMessage(EVENT_READY, message.origin)
      return
    }

    // Ignore the ready message when viewing the hub directly
    if (message.data === EVENT_READY) return

    // Check whether message.data is a valid json
    let request: CrossStorageRequest
    try {
      request = JSON.parse(message.data)

      // Check whether request.method is a string
      if (!request.id || !request.method) {
        return
      }
    } catch (err) {
      return
    }

    const method = request.method

    if (!allowedMethods.has(method)) {
      this._response(origin, request, `Invalid method ${method}, allowed methods are ${Array.from(allowedMethods).join(', ')}`, null)
      return
    }

    if (!this._permitted(origin, method)) {
      this._response(origin, request, `Invalid permissions for ${method}`, null)
      return
    }

    let result: any

    try {
      switch (method) {
        case CrossStorageAction.GET:
          result = get(request.key)
          break
        case CrossStorageAction.SET:
          set(request.key, request.value)
          break
        case CrossStorageAction.DEL:
          del(request.key)
          break
        case CrossStorageAction.CLEAR:
          clear()
          break
        case CrossStorageAction.GET_KEYS:
          result = getKeys()
          break
      }
    } catch (error: unknown) {
      this._response(origin, request, (error as Error).message, null)
      return
    }
    this._response(origin, request, undefined, result)
  }

  _onStorage = (event: StorageEvent) => {
    if (event.storageArea !== storage) return
    const key = event.key

    // Returns a string that represents the key changed. The key attribute is null when the change is caused by the storage clear() method.
    if (!key) {
      window.parent.postMessage(`${EVENT_CHANGE}:*`, '*')
      return
    }

    // ignore if key is not in watchKeys
    if (Array.isArray(this.watchKeys) && !this.watchKeys.includes(key)) {
      return
    }

    // only send the key that changed for security reasons
    window.parent.postMessage(`${EVENT_CHANGE}:${key}`, '*')
  }

  _response = (
    origin: string,
    request: CrossStorageRequest,
    error?: string,
    result?: any
  ) => {
    const response = JSON.stringify({
      id: request.id,
      method: request.method,
      error,
      result
    })

    // postMessage requires that the target origin be set to "*" for "file://"
    const targetOrigin = (origin === 'file://') ? '*' : origin

    window.parent.postMessage(response, targetOrigin)
  }

  /**
   * Returns a boolean indicating whether or not the requested method is
   * permitted for the given origin. The argument passed to method is expected
   * to be one of 'get', 'set', 'del' or 'getKeys'.
   */
  _permitted(origin: string, method: CrossStorageAction) {
    return this.permissions.some(entry => {
      if (typeof entry.origin === 'string') {
        if (origin !== entry.origin) return false
      } else {
        if (!entry.origin.test(origin)) return false
      }
      const allow = entry.allow
      if (allow === '*') return true
      return allow.includes(method)
    })
  }
}



function set(key: string, value: any) {
  storage.setItem(key, value)
}

function get(key: string | string[]) {
  if (Array.isArray(key)) {
    return key.reduce((acc, k) => {
      acc[k] = storage.getItem(k)
      return acc
    }, {} as Record<string, any>)
  }
  return storage.getItem(key)
}

function del(key: string | string[]) {
  if (Array.isArray(key)) {
    key.forEach(k => storage.removeItem(k))
  } else {
    storage.removeItem(key)
  }
}

function clear() {
  storage.clear()
}

function getKeys() {
  const result = []
  for (let i = 0; i < storage.length; i++) {
    result.push(storage.key(i))
  }
  return result
}
