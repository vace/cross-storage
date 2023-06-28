# cross-storage

Cross domain local storage, with permissions. Enables multiple browser windows/tabs, across a variety of domains, to share a single localStorage. fork from [cross-storage](https://github.com/zendesk/cross-storage)

## Usage

### Hub

```js
import Hub from 'cross-storage-hub'
Hub.init({
  /**
   * watch storage change
   */
  watch: true,
  // watch: ['token', 'Authorization'],

  /**
   * permissions
   */
  permissions: [
    { origin: /^http:\/\/localhost/, allow: '*' },
    { origin: /^http:\/\/127\.0\.0\.1/, allow: '*' },
    { origin: 'https://github.com', allow: ['get', 'set', 'del', 'getKeys', 'clear'] },
  ],
})
```


### Client

** client1 **

```js
import Client from 'cross-storage-client'

// the url of the hub
const client = new Client('http://localhost:3001/hub.html')

client.connect().then(() => {
  client.set('foo', new Date().toISOString())

  client.get('foo').then(val => {
    console.log('get foo', val)
  })
})
```

** client2 **

```js

import Client from 'cross-storage-client'

const client = new Client('http://localhost:3001/hub.html')

client.connect().then(() => {
  // watch key change from other client
  client.watch(key => {
    console.log(`key ${key} changed`)

    client.get(key).then(val => {
      console.log('change get val', val)
    })
  })
})

```

## API

### Hub

#### Hub.init(options)

- `options` {Object}
  - `watch` {Boolean|Array} watch storage change
    - `false` not watch
    - `true` watch all storage change
    - `string[]` watch the keys
  - `permissions` {Array} permissions
    - origin: `RegExp` or `string` the origin of the parent window
    - allow: `'*'` or `CrossStorageAction[]` the actions that are allowed, or "*" for all actions

```ts
type CrossStorageHubOptions = {
  /**
   * - true: watch all storage change
   * - string[]: watch the keys
   */
  watch?: string[] | boolean;

  permissions: {
    /**
     * The origin of the parent window
     */
    origin: RegExp | string;
    /**
     * The actions that are allowed, or "*" for all actions
     */
    allow: '*' | CrossStorageAction[];
  }[];
};
```

### Client

#### Client.connect()

connect to the hub

```ts
client.connect().then(() => {
  // do something
  client.set('foo', new Date().toISOString())
})
```


#### Client.get(key)

get the value of the key

```ts

client.get('foo').then(val => {
  console.log('get foo', val) // val is string or null
})

client.get(['foo', 'bar']).then(val => {
  console.log('get foo, bar', val) // val is {foo: string | null, bar: string | null}
})

```

#### Client.set(key, value)

set the value of the key

```ts
client.set('foo', new Date().toISOString())
```

#### Client.del(key)

delete the key

```ts
client.del('foo')
```

#### Client.getKeys()

get all keys

```ts
client.getKeys().then(keys => {
  console.log('keys', keys) // keys is string[]
})
```

#### Client.clear()

clear all keys

```ts
client.clear()
```

#### Client.watch(callback)

watch the key change

```ts
const unWatch = client.watch(key => {
  console.log(`key ${key} changed`)

  client.get(key).then(val => {
    console.log('change get val', val)
  })
})

// if you want to stop watching
// unWatch() 
```

#### Client.close()

close the connection

```ts
client.close()
```
