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

export type CrossStorageHubOptions = {
  permissions: CrossStoragePermission[]
  watch?: string[] | boolean
}

/**
 * The actions that can be performed on the cross storage hub
 */
export type CrossStoragePermission = {
  /**
   * The origin of the parent window
   */
  origin: RegExp | string

  /**
   * The actions that are allowed, or "*" for all actions
   */
  allow: '*' | CrossStorageAction[]
}

export type CrossStorageRequest = CrossStorageRequestSet | CrossStorageRequestGet | CrossStorageRequestDel | CrossStorageRequestGetKeys | CrossStorageRequestClear

export type CrossStorageRequestSet = {
  id: string
  method: CrossStorageAction.SET
  key: string
  value: any
}

export type CrossStorageRequestGet = {
  id: string
  method: CrossStorageAction.GET
  key: string | string[]
}

export type CrossStorageRequestDel = {
  id: string
  method: CrossStorageAction.DEL
  key: string | string[]
}

export type CrossStorageRequestGetKeys = {
  id: string
  method: CrossStorageAction.GET_KEYS
}

export type CrossStorageRequestClear = {
  id: string
  method: CrossStorageAction.CLEAR
}

