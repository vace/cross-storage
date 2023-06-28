import { CrossStorageAction, CrossStorageResponse, type CrossStorageClientOptions, WatchHandler } from './types.js'

const EVENT_UNAVAILABLE = 'cross-storage:unavailable'
const EVENT_READY = 'cross-storage:ready'
const EVENT_POLL = 'cross-storage:poll'
const EVENT_CHANGE = 'cross-storage:change'

export default class CrossStorageClient {

  /**
   * A UUID v4 id
   */
  id = uuid()

  /**
   * The hub's origin
   */
  origin: string

  /**
   * Whether or not it has connected
   */
  connected = false

  /**
   * Whether or not the client has closed
   */
  closed = false

  /**
   * Number of requests sent
   */
  count = 0

  /**
   * The iframe element
   */
  frame: HTMLIFrameElement | null = null

  /**
   * The requests that have been sent
   */
  _requests: Record<string, (response: CrossStorageResponse) => void> = Object.create(null)

  /**
   * The connect callbacks
   */
  _connects: Array<(err?: Error) => void> = []

  /**
   * The watchers
   */
  _watchers: WatchHandler[] = []


  public constructor(
    /**
     * The url of the hub
     */
    public url: string,

    /**
     * The options for the client
     */
    public options: CrossStorageClientOptions = {},
  ) {
    this.origin = new URL(url).origin

    window.addEventListener('message', this._onListener, false)

    this.frame = options.frameId ? (document.getElementById(options.frameId) as HTMLIFrameElement) : null

    if (this.frame) {
      this._poll()
    } else {
      this.frame = this._createFrame()
    }
  }

  /**
   * The frame element id
   */
  get frameId () {
    return this.options.frameId ?? `cross-storage-client-${this.id}`;
  }

  /**
   * timeout for requests
   */
  get timeout () {
    return this.options.timeout ?? 30_000
  }

  /**
   * The frame element contentWindow
   */
  get hub () {
    return this.frame?.contentWindow as Window
  }

  /**
   * current origin of the client
   */
  get targetOrigin () {
    return this.origin === 'file://' ? '*' : this.origin
  }

  /**
   * connect to the hub and resolve when ready
   */
  connect(): Promise<this> {
    if (this.connected) {
      return Promise.resolve(this)
    }
    if (this.closed) {
      return Promise.reject(new Error('CrossStorageClient has been closed'))
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // this.close()
        reject(new Error(`CrossStorageClient timed out after ${this.timeout}ms`))
      }, this.timeout)

      this._connects.push((err?: Error) => {
        clearTimeout(timeoutId)
        err ? reject(err) : resolve(this)
      })
    })
  }

  /**
   * watch for changes to keys
   */
  watch (watcher: WatchHandler) {
    this._watchers.push(watcher)

    return () => {
      const index = this._watchers.indexOf(watcher)
      if (index > -1) {
        this._watchers.splice(index, 1)
      }
    }
  }

  set (key: string, value: any) {
    return this._request<void>(CrossStorageAction.SET, { key, value })
  }

  get<T extends string | string[]>(key: T) {
    return this._request<T extends string ? string | null : Record<string, string | null>>(CrossStorageAction.GET, { key })
  }

  del (key: string | string[]) {
    return this._request<void>(CrossStorageAction.DEL, { key })
  }

  getKeys () {
    return this._request<string[]>(CrossStorageAction.GET_KEYS)
  }

  clear () {
    return this._request<void>(CrossStorageAction.CLEAR)
  }

  close () {
    const frame = document.getElementById(this.frameId)
    if (frame) {
      frame.remove()
    }

    window.removeEventListener('message', this._onListener, false)

    this.closed = true
    this.connected = false
  }

  _onListener = (message: MessageEvent) => {
    const messageData = message.data as string
    // Ignore invalid messages or those after the client has closed
    if (this.closed || !messageData || typeof messageData !== 'string') {
      return
    }

    // postMessage returns the string "null" as the origin for "file://"
    const origin = message.origin === 'null' ? 'file://' : message.origin

    // Ignore messages not from the correct origin
    if (origin !== this.origin) {
      return
    }

    // LocalStorage isn't available in the hub
    if (messageData === EVENT_UNAVAILABLE) {
      if (!this.closed) this.close()
      if (this._connects.length) {
        const error = new Error('CrossStorageHub unavailable, check if localStorage is enabled in the hub domain')
        this._connects.forEach((cb) => cb(error))
      }
      return
    }

    // Handle initial connection
    if (messageData.startsWith('cross-storage:') && !this.connected) {
      this.connected = true;
      if (this._connects.length) {
        this._connects.forEach((cb) => cb())
        this._connects.length = 0
      }
    }
  
    const watchers = this._watchers

    if (watchers.length && messageData.startsWith(`${EVENT_CHANGE}:`)) {
      const watchKey = messageData.slice(EVENT_CHANGE.length + 1)
      const changeKey = watchKey === '*' ? null : watchKey
      watchers.forEach((watcher) => watcher(changeKey))
    }

    if (messageData === EVENT_READY) {
      return
    }

    // All other messages
    let response: any
    try {
      response = JSON.parse(message.data)
    } catch (e) {
      return
    }

    if (!response.id) return

    const requestCallback = this._requests[response.id]
    if (requestCallback) {
      requestCallback(response)
    }
  }

  _poll () {
    // postMessage requires that the target origin be set to "*" for "file://"
    const targetOrigin = this.targetOrigin

    const interval = setInterval(() => {
      if (this.connected) {
        clearInterval(interval)
        return
      }
      if (!this.hub) {
        return
      }
      this.hub.postMessage(EVENT_POLL, targetOrigin)
    }, 1000)
  }

  _createFrame () {
    const frame = document.createElement('iframe')
    frame.id = this.frameId

    const styles = {
      display: 'none',
      width: '0',
      height: '0',
      position: 'absolute',
      top: '-9999px',
      left: '-9999px'
    } as const

    // for in 
    for (const key in styles) {
      // @ts-ignore
      frame.style[key] = styles[key]
    }

    document.body.appendChild(frame)
    frame.src = this.url

    return frame
  }

  _request<T>(method: CrossStorageAction, params?: Record<string, any>): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error('CrossStorageClient has been closed'))
    }
    if (!this.connected) {
      return Promise.reject(new Error('CrossStorageClient is not connected'))
    }

    this.count += 1
    const request = {
      id: `${this.id}:${this.count}`,
      method,
      ...params
    }

    const requestsCache = this._requests

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!requestsCache[request.id]) return
        delete requestsCache[request.id]
        reject(new Error(`Timeout: cross-storage:${method} request timed out after ${this.timeout}ms`))
      }, this.timeout)

      if (!this.hub) {
        clearTimeout(timeout)
        return reject(new Error('CrossStorageClient hub is not available'))
      }

      requestsCache[request.id] = (response) => {
        clearTimeout(timeout)
        delete requestsCache[request.id]

        if (response.error) {
          const err = new Error(response.error)
          return reject(err)
        }
        return resolve(response.result as T)
      }

      this.hub.postMessage(JSON.stringify(request), this.targetOrigin)
    })
  }
}

function uuid () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
