# Hub

Statefull client library for IOTA.

---

## API reference

## Modules

<dl>
<dt><a href="#module_address">address</a></dt>
<dd><p>Securely generate new deposit addresses.</p>
</dd>
<dt><a href="#module_errors">errors</a></dt>
<dd><p>Common errors thrown by hub methods.</p>
</dd>
<dt><a href="#module_process">process</a></dt>
<dd><p>Sweeps tokens from spent addresses.</p>
</dd>
<dt><a href="#module_sync">sync</a></dt>
<dd><p>Synchronizes local state with ledger.</p>
</dd>
<dt><a href="#module_transfer">transfer</a></dt>
<dd><p>Utilities for executing transactions.</p>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#Hub">Hub</a></dt>
<dd><p>Hub</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#State">State</a> : <code>object</code></dt>
<dd><p>Contains account data of a particular seed</p>
</dd>
<dt><a href="#Address">Address</a> : <code>Object</code></dt>
<dd><p>Address object</p>
</dd>
<dt><a href="#Transaction">Transaction</a> : <code>object</code></dt>
<dd><p>Transaction Object</p>
</dd>
<dt><a href="#Transfer">Transfer</a> : <code>object</code></dt>
<dd><p>Transfer object</p>
</dd>
</dl>

<a name="module_address"></a>

## address
Securely generate new deposit addresses.

<a name="module_address..getNewAddress"></a>

### address~getNewAddress(hub, state, seed, [security], [checksum]) ⇒ <code>object</code>
Generates a new address by incrementing `state.keyIndex` and mutates the [`state`](#State).

 > **NOTICE:**
 >
 > Always provide an up-to-date [`state`](#State) that contains the latest key index.

**Kind**: inner method of [<code>address</code>](#module_address)  
**Returns**: <code>object</code> - Returns the updated [`state`](#State) and the new `address` as 81-trytes `string`.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| hub | [<code>Hub</code>](#Hub) |  | Hub instance |
| state | [<code>State</code>](#State) |  | State object |
| seed | <code>string</code> |  | Seed |
| [security] | <code>int</code> | <code>2</code> | Security level, can be 1, 2 or 3 |
| [checksum] | <code>boolean</code> | <code>false</code> | Flag to include checksum |

<a name="module_errors"></a>

## errors
Common errors thrown by hub methods.


* [errors](#module_errors)
    * [~INVALID_ARGUMENTS](#module_errors..INVALID_ARGUMENTS) : <code>string</code>
    * [~INCONSISTENT_LOCAL_STATE](#module_errors..INCONSISTENT_LOCAL_STATE) : <code>string</code>
    * [~NO_INPUTS_AVAILABLE](#module_errors..NO_INPUTS_AVAILABLE) : <code>string</code>
    * [~INSUFFICIENT_BALANCE](#module_errors..INSUFFICIENT_BALANCE) : <code>string</code>
    * [~INVALID_REMAINDER_ADDRESS](#module_errors..INVALID_REMAINDER_ADDRESS) : <code>string</code>
    * [~UNDEFINED_LAST_INDEX](#module_errors..UNDEFINED_LAST_INDEX) : <code>string</code>

<a name="module_errors..INVALID_ARGUMENTS"></a>

### errors~INVALID_ARGUMENTS : <code>string</code>
Invalid arguments

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_errors..INCONSISTENT_LOCAL_STATE"></a>

### errors~INCONSISTENT_LOCAL_STATE : <code>string</code>
Inconsistent local state

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_errors..NO_INPUTS_AVAILABLE"></a>

### errors~NO_INPUTS_AVAILABLE : <code>string</code>
No inputs available

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_errors..INSUFFICIENT_BALANCE"></a>

### errors~INSUFFICIENT_BALANCE : <code>string</code>
Insufficient balance

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_errors..INVALID_REMAINDER_ADDRESS"></a>

### errors~INVALID_REMAINDER_ADDRESS : <code>string</code>
Invalid remainder address

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_errors..UNDEFINED_LAST_INDEX"></a>

### errors~UNDEFINED_LAST_INDEX : <code>string</code>
Undefined last index

**Kind**: inner constant of [<code>errors</code>](#module_errors)  
<a name="module_process"></a>

## process
Sweeps tokens from spent addresses.

<a name="module_process..sweep"></a>

### process~sweep(hub, state, seed, [options]) ⇒ <code>object</code>
Sweeps value from used addresses to new ones, by preparing the transaction trytes in batches.
 Updates the [`state`](#State).

 > **NOTICE:**
 >
 > Use this method _only if hub is synced_. Use [`sync()`](sync) to synchronize the hub.

 > **TIP:**
 >
 > Use [`sendTrytes()`](sendTrytes) _for each batch_ to attach the returned `trytes` to tangle.

**Kind**: inner method of [<code>process</code>](#module_process)  
**Returns**: <code>object</code> - Returns an `object` of the updated [`state`](#State) and `array` of transaction `trytes`.  
**Todo**

- [ ] Validate the bundles of pending sweep transactions.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| hub | [<code>Hub</code>](#Hub) |  | Hub instance |
| state | [<code>State</code>](#State) |  | State |
| seed | <code>string</code> |  | Seed |
| [options] | <code>object</code> |  | Options |
| [options.security] | <code>int</code> | <code>2</code> | Security level |
| [options.inputsPerBundle] | <code>int</code> | <code>4</code> | Inputs per bundle |
| [options.balanceThreshold] | <code>int</code> | <code>0</code> | Balance threshold |

<a name="module_sync"></a>

## sync
Synchronizes local state with ledger.

**Todo**

- [ ] Add method to get the full bundles by fetching missing transactions.
- [ ] Emit events uppon withdrawal confirmation.

<a name="module_sync..sync"></a>

### sync~sync(hub, state, seed, [options]) ⇒ <code>Promise.&lt;(State\|Error)&gt;</code>
Syncronizes the hub with the current ledger [`state`](#State).

 > **NOTICE:**
 >
 > It is important to save the [`state`](#State) in persistent storage after synchronization.
 > During snapshots transaction history is being erased, hence keeping track of used key indexes in `state.indexes` is required.

**Kind**: inner method of [<code>sync</code>](#module_sync)  
**Returns**: <code>Promise.&lt;(State\|Error)&gt;</code> - Returns `promise` wich resolves to the synchronized [state](#State).  
**Emits**: [<code>deposit</code>](#Hub+event_deposit), [<code>sweep</code>](#Hub+event_sweep)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| hub | [<code>Hub</code>](#Hub) |  | Hub instance |
| state | [<code>State</code>](#State) |  | State object to hold the hub data |
| seed | <code>string</code> |  | Seed associated to the addresses of the hub |
| [options] | <code>object</code> |  | Options |
| [options.security] | <code>int</code> | <code>2</code> | Security level of addresses |
| [options.rescan] | <code>boolean</code> | <code>true</code> | If true, sync fetches the entire transactions history |
| [options.enableEvents] | <code>boolean</code> | <code>false</code> | Flag to enable events |

<a name="module_transfer"></a>

## transfer
Utilities for executing transactions.

**Todo**

- [ ] Implement reattachments and promotion.


* [transfer](#module_transfer)
    * [~prepareTransfers(hub, state, seed, transfers)](#module_transfer..prepareTransfers) ⇒ <code>object</code>
    * [~sendTrytes(hub, state, trytes, depth, minWeightMagnitude)](#module_transfer..sendTrytes) ⇒ <code>Promise.&lt;(Object\|Error)&gt;</code>

<a name="module_transfer..prepareTransfers"></a>

### transfer~prepareTransfers(hub, state, seed, transfers) ⇒ <code>object</code>
Prepares the transactions trytes and updates the [`state`](#State).

 > **NOTICE:**
 >
 > Use this method _only if hub is synced_. Use [`sync()`](sync) to synchronize the hub.

 > **TIP:**
 >
 > Use [`sendTrytes()`](sendTrytes) to attach the returned `trytes` to tangle.

**Kind**: inner method of [<code>transfer</code>](#module_transfer)  
**Returns**: <code>object</code> - Returns an `object` of the updated [`state`](#State) and `array` of the transaction `trytes`.  
**Todo**

- [ ] Validate the bundles of pending transactions that send to inputs.
- [ ] Allow spending from change address to speedup tranfers.
- [ ] Add option to batch transactions into separate bundles.


| Param | Type | Description |
| --- | --- | --- |
| hub | [<code>Hub</code>](#Hub) | Hub instance |
| state | [<code>State</code>](#State) | State object |
| seed | <code>string</code> | Seed |
| transfers | [<code>array.&lt;Transfer&gt;</code>](#Transfer) | Transfer objects |

<a name="module_transfer..sendTrytes"></a>

### transfer~sendTrytes(hub, state, trytes, depth, minWeightMagnitude) ⇒ <code>Promise.&lt;(Object\|Error)&gt;</code>
Does tip selection, attaches to tangle, broadcasts transactions and updates the [`state`](#State).

**Kind**: inner method of [<code>transfer</code>](#module_transfer)  
**Returns**: <code>Promise.&lt;(Object\|Error)&gt;</code> - Returns `promise` which resolves to updated [`state`](#State) and attached transaction objects.  

| Param | Type | Description |
| --- | --- | --- |
| hub | [<code>Hub</code>](#Hub) | Hub instance |
| state | [<code>State</code>](#State) | State object |
| trytes | <code>array</code> | Trytes array |
| depth | <code>int</code> | Depth |
| minWeightMagnitude | <code>int</code> | Min weight magnitude |

<a name="Hub"></a>

## Hub
Hub

**Kind**: global class  

* [Hub](#Hub)
    * [new Hub(provider)](#new_Hub_new)
    * ["deposit"](#Hub+event_deposit)
    * ["sweep"](#Hub+event_sweep)

<a name="new_Hub_new"></a>

### new Hub(provider)
Creates a hub instance and connects to a node


| Param | Type | Description |
| --- | --- | --- |
| provider | <code>string</code> | IOTA API provider uri (default: http://localhost:14265) |

<a name="Hub+event_deposit"></a>

### "deposit"
_Confirmed_ transction depositing to an address.
 Passes the [transaction](#Transaction) object as first argument.

**Kind**: event emitted by [<code>Hub</code>](#Hub)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| hash | <code>string</code> | Transaction hash |
| address | <code>string</code> | Address |
| value | <code>int</code> | Value |
| tag | <code>string</code> | 27-trytes tag |
| timestamp | <code>int</code> | Timestamp |

<a name="Hub+event_sweep"></a>

### "sweep"
_Confirmed_ transction sweeping tokens from an address.
 Passes the [transaction](#Transaction) object as first argument.

**Kind**: event emitted by [<code>Hub</code>](#Hub)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| hash | <code>string</code> | Transaction hash |
| address | <code>string</code> | Address |
| value | <code>int</code> | Value |
| tag | <code>string</code> | 27-trytes tag |
| timestamp | <code>int</code> | Timestamp |

<a name="State"></a>

## State : <code>object</code>
Contains account data of a particular seed

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| addresses | [<code>array.&lt;Address&gt;</code>](#Address) | Array of addresses |
| inputs | [<code>array.&lt;Address&gt;</code>](#Address) | Array of unpsent addresses with balance |
| transfers | [<code>array.&lt;Transaction&gt;</code>](#Transaction) | Array of transaction objects |
| indexes | <code>array.&lt;int&gt;</code> | List of used key indexes |
| keyIndex | <code>int</code> | Last key index to generate new addresses |

<a name="Address"></a>

## Address : <code>Object</code>
Address object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | 81-trytes address |
| index | <code>int</code> | Corresponding key index |
| security | <code>int</code> | Security level can be 1,2 or 3 |
| balance | <code>balance</code> | Balance in iotas |

<a name="Transaction"></a>

## Transaction : <code>object</code>
Transaction Object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| hash | <code>string</code> | Transaction hash |
| address | <code>string</code> | Address |
| value | <code>int</code> | Value transferred in iotas |
| tag | <code>string</code> | 27-trytes tag |
| obsoleteTag | <code>string</code> | Obsolete tag (soon to be removed) |
| signatureMessageFragment | <code>string</code> | Signature fragment |
| bundle | <code>string</code> | Bundle hash |
| currentIndex | <code>int</code> | Index of current transaction in bundle |
| lastIndex | <code>int</code> | Index of last transaction in bundle |
| timestamp | <code>int</code> | Timestamp |
| attachmentTimestamp | <code>int</code> | Attachment timestamp |
| attachmentTimestampLowerBound | <code>int</code> | Lower bound of timestamp |
| attachmentTimestampUpperBound | <code>int</code> | Upper bound of timestamp |
| nonce | <code>string</code> | Nonce generated during Proof-of-Work |
| trunkTransaction | <code>string</code> | Trunk transaction hash |
| branchTransaction | <code>string</code> | Branch transaction hash |
| persistence | <code>boolean</code> | Persistence status |

<a name="Transfer"></a>

## Transfer : <code>object</code>
Transfer object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | Destination address |
| value | <code>int</code> | Value to send in iotas |
| tag | <code>string</code> | Optional 27-trytes tag |
| message | <code>string</code> | Optional tryte-encoded message |


