/**
 * The actions that can be performed on the cross storage hub
 */
export enum CrossStorageAction {
  SET = 'set',
  GET = 'get',
  DEL = 'del',
  GET_KEYS = 'getKeys',
  CLEAR = 'clear',
}

export interface CrossStorageClientOptions {
  /**
   * The id of the iFrame pointing to the hub url
   */
  frameId?: string;

  /**
   * The timeout for requests, defaults to 30 seconds
   */
  timeout?: number;
}

export interface CrossStorageResponse {
  /**
   * The id of the request
   */
  id: string;

  /**
   * The method of the request
   */
  method: CrossStorageAction;

  /**
   * The error if the request failed
   */
  error?: string;

  /**
   * The result of the request
   */
  result?: unknown;
}

/**
 * watch keys for changes
 */
export type WatchHandler = (changeKey: string | null) => void
