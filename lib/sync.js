'use strict'

const { signing, utils } = require('iota.crypto.js')
const { deepClone } = require('./utils')
const errors = require('./errors')

/** Type definitions of state object structure. */

/**
 *  @typedef {object} State Contains account data of a particular seed
 *
 *  @prop {array<Address>} addresses Array of addresses
 *  @prop {array<Address>} inputs Array of unpsent addresses with balance
 *  @prop {array<Transaction>} transfers Array of transaction objects
 *  @prop {array<int>} indexes List of used key indexes
 *  @prop {int} keyIndex Last key index to generate new addresses
 */

/**
 *  @typedef {Object} Address Address object
 *
 *  @prop {string} address 81-trytes address
 *  @prop {int} index Corresponding key index
 *  @prop {int} security Security level can be 1,2 or 3
 *  @prop {balance} [balance] Balance in iotas
 */

/**
 *  @typedef {object} Transaction Transaction Object
 *
 *  @prop {string} hash Transaction hash
 *  @prop {string} address Address
 *  @prop {int} value Value transferred in iotas
 *  @prop {string} tag 27-trytes tag
 *  @prop {string} obsoleteTag Obsolete tag (soon to be removed)
 *  @prop {string} signatureMessageFragment Signature fragment
 *  @prop {string} bundle Bundle hash
 *  @prop {int} currentIndex Index of current transaction in bundle
 *  @prop {int} lastIndex Index of last transaction in bundle
 *  @prop {int} timestamp Timestamp
 *  @prop {int} [attachmentTimestamp] Attachment timestamp
 *  @prop {int} [attachmentTimestampLowerBound] Lower bound of timestamp
 *  @prop {int} [attachmentTimestampUpperBound] Upper bound of timestamp
 *  @prop {string} [nonce] Nonce generated during Proof-of-Work
 *  @prop {string} [trunkTransaction] Trunk transaction hash
 *  @prop {string} [branchTransaction] Branch transaction hash
 *  @prop {boolean} [persistence] Persistence status
 */

/**
 *  @module sync
 *
 *  @description Synchronizes local state with ledger.
 *
 *  @todo Add method to get the full bundles by fetching missing transactions.
 *  @todo Emit events uppon withdrawal confirmation.
 */

/**
 *  @method sync
 *
 *  @description
 *  Syncronizes the hub with the current ledger [`state`]{@link State}.
 *
 *  > **NOTICE:**
 *  >
 *  > It is important to save the [`state`]{@link State} in persistent storage after synchronization.
 *  > During snapshots transaction history is being erased, hence keeping track of used key indexes in `state.indexes` is required.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object to hold the hub data
 *  @param {string} seed - Seed associated to the addresses of the hub
 *  @param {object} [options] - Options
 *  @param {int} [options.security=2] - Security level of addresses
 *  @param {boolean} [options.rescan=true] - If true, sync fetches the entire transactions history
 *  @param {boolean} [options.enableEvents=false] - Flag to enable events
 *
 *  @return {Promise<State|Error>} Returns `promise` wich resolves to the synchronized [state]{@link State}.
 *
 *  @emits Hub#deposit
 *  @emits Hub#sweep
 */
function sync (hub, state, seed, { security = 2, rescan = true, enableEvents = false }) {
  if (!seed) {
    throw new Error(errors.INVALID_ARGUMENTS)
  }

  // Don't mutate original state object
  const stateCopy = deepClone(state)

  // If we rescan fetch new addresses
  return (rescan ? syncAddresses(hub, stateCopy, seed, security) : Promise.resolve(stateCopy))

    // Sync balances of all addresses and inputs in state
    .then(stateCopy => syncBalances(hub, stateCopy))

    // Scan for transactions and generate a diff between ledger and local state
    .then(stateCopy => getTransfersDiff(hub, stateCopy, state, rescan)

      // Apply the transfer diff to the local state
      .then(diff => applyTransfersDiff(stateCopy, diff, enableEvents ? hub : null))
    )
}

/**
 *  @method syncAddresses
 *
 *  @ignore
 *
 *  @description
 *  Scans for transactions associated to addresses above the last known index
 *  and adds all new addresses in local state.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object
 *  @param {string} seed - Seed associated to the addresses of the hub
 *  @param {int} security - Security level of addresses
 *
 *  @return {Promise<State|Error>}
 */
function syncAddresses (hub, state, seed, security = 2) {
  // Get next key index
  const index = state.keyIndex

  // Fetch all used addresses starting from selected index
  return hub.api.getNewAddress(seed, {index, security, returnAll: true, checksum: false})

    .then(newAddresses => {
      // Construct address objects and add them in state
      state.addresses = state.addresses.concat(
        newAddresses.slice(0, -1).map((address, i) => ({ address, index: index + i, security }))
      )

      // Update last key index
      if (newAddresses.length) {
        state.keyIndex += newAddresses.length - 1
      }

      return state
    })
}

/**
 *  @method syncBalance
 *
 *  @ignore
 *
 *  @description
 *  Updates balances of all addresses and inputs in state. Mutates the [`state`]{@link State} object.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object
 *
 *  @return {Promise<State|Error>}
 */
function syncBalances (hub, state) {
  // Fetch balances of all inputs and addresses
  return hub.api.getBalances(state.addresses.concat(state.inputs).map(address => address.address), 100)
    .then(res => {
      const getStateEntry = (state, i, l) => (i < l ? state.addresses : state.inputs)[i < l ? i : i - l]
      const setBalance = (state, i, l, balance) => {
        getStateEntry(state, i, l).balance = parseInt(balance)
      }

      // Update balances in local state
      res.balances.forEach((balance, i) => setBalance(state, i, state.addresses.length, balance))

      return state
    })
}

/**
 *  @method getTransfersDiff
 *
 *  @ignore
 *
 *  @description
 *  Constructs a transfers diff between local and ledger state.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - Latest state object
 *  @param {State} previousState - Previous state object
 *  @param {boolean} rescan - Rescan complete transfer history
 *
 *  @return {Promise.<array>}
 */
function getTransfersDiff (hub, state, previousState, rescan = true) {
  const currentStateAddresses = state.addresses.concat(state.inputs) // Latest state of addresses
  let addresses // Addresses to query

  // If we rescan find transactions of all addresses and inputs in state
  if (rescan) {
    addresses = currentStateAddresses
  } else { // Otherwise find transactions associated to addresses with balance diff
    const previousStateAddresses = previousState.addresses.concat(previousState.inputs) // Previous state of addresses

    // Compare the two state versions and select addresses with balance diff
    addresses = currentStateAddresses
      .filter(b => previousStateAddresses.find(a => a.address === b.address).balance !== b.balance)
  }

  // Fetch transfers
  return hub.api.findTransactionObjects({ addresses: addresses.map(address => address.address) })

    // Filter out confirmed txs that exist in local state
    .then(txs => txs
      .filter(tx => state.transfers
        .findIndex(stateTx => stateTx.hash === tx.hash && stateTx.persistence) === -1
      )
    )

    // Include all unconfirmed transfers
    .then(txs => txs
      .concat(
        state.transfers.filter(stateTx => stateTx.hash && !stateTx.persistence &&
          txs.findIndex(tx => tx.hash === stateTx.hash) === -1
        )
      )
    )

    // Fetch inclusion states
    .then(txs => hub.api.getLatestInclusion(txs.map(tx => tx.hash))

      // Map inclusion states to transfers list
      .then(inclusionStates => txs.map((tx, i) => ({ ...tx, persistence: inclusionStates[i] })))
    )

    // Filter out txs that are even with local state
    .then(txs => txs
      .filter(tx => state.transfers
        .findIndex(stateTx => stateTx.hash === tx.hash && stateTx.persistence !== tx.persistenece) === -1
      )
    )
}

/**
 *  @method applyTransfersDiff
 *
 *  @ignore
 *
 *  @description
 *  Applies a transfers diff to local state.
 *  Adds new transfers in state, updates inclusion states and marks any
 *  used inputs as addresses.
 *
 *  @param {State} state - State object
 *  @param {array} diff - State diff
 *  @param {object} eventEmitter - Event emitter
 *  @param {Promise<State|Error>}
 *
 *  @return {State}
 */
function applyTransfersDiff (state, diff, eventEmitter) {
  const diffCopy = [...diff].filter(tx => tx.value <= 0) // Diff copy used to validate the signatures
  const seenSpentAddresses = new Set() // Set of seen spent addresses used for skipping extra validations

  // Process spending transactions
  for (const tx of diff.filter(tx => tx.value < 0)) {
    const signatureFragmentsLength = state.addresses.find(address => address.address === tx.address).security

    // Check if signature is valid and correspending address was marked as spent
    if (!seenSpentAddresses.has(tx.address) &&
      (tx.persistence || _validateSignatures(diffCopy, tx, signatureFragmentsLength))) {
      // Find input index, if any
      const inputIndex = state.inputs.findIndex(input => input.address === tx.address)
      let keyIndex

      // Find correspoding key index
      if (inputIndex !== -1) { // address belongs to inputs list
        keyIndex = state.inputs[inputIndex].index

        // Move input to addresses list
        state.addresses.push(state.inputs.splice(inputIndex, 1).pop())
      } else { // get key index if address belongs to addresses list
        keyIndex = state.addresses.find(address => address.address === tx.address).index || null
      }

      // If key index was found mark it as used
      if (keyIndex) {
        markKeyAsUsed(state.indexes, keyIndex)
      } else { // Otherwise throw inconsistent state error
        throw new Error(errors.INCONSISTENT_LOCAL_STATE)
      }

      // Mark spent address as seen to skip unecessary checks
      seenSpentAddresses.add(tx.address)
    }
  }

  // Move unspent address with balance to inputs list
  for (const input of state.addresses
    .filter(address => address.balance > 0 && !isUsedKey(state.indexes, address.index))) {
    const addressIndex = state.addresses.findIndex(address => address.address === input.address)

    state.inputs.push(state.addresses.splice(addressIndex, 1).pop())
  }

  // Dispatch deposit events
  if (eventEmitter) {
    const sweeps = new Set() // Set of sweep bundle hashes

    for (const tx of diff.filter(tx => tx.value > 0 && tx.persistence)) {
      // Attempt to get all bundle transactions from diff
      const bundle = [...diff]
        .filter(diffTx => diffTx.bundle === tx.bundle && diffTx.persistence)
        .sort((a, b) => a.currentIndex - b.currentIndex)

      // Check if is sweep transfer
      if (bundle.length - 1 === tx.lastIndex && !sweeps.has(tx.bundle)) {
        // Ensure that bundle is valid and value is not being sent back to inputs
        if (utils.isBundle(bundle) && !_isSendingValueToInputs(bundle)) {
          // Track all sweeps
          sweeps.add(tx.bundle)

          // Emit sweep events for each swept address
          for (const tx of bundle.filter(tx => tx.value < 0)) {
            eventEmitter.emit('sweep', tx)
          }
        }
      } else if (bundle.findIndex(tx => tx.value < 0) === -1 &&
        state.inputs.findIndex(input => input.address === tx.address) > -1) { // Handle deposit transactions
        eventEmitter.emit('deposit', tx)
      }
    }
  }

  // Update transfers in state
  for (const tx of diff) {
    // Check if transfer exists in local state
    const transfersIndex = state.transfers.findIndex(stateTx => stateTx.hash === tx.hash)

    // Copy untracked transfers to state
    if (transfersIndex === -1) {
      state.transfers.push(tx)
    } else { // Update persistence
      state.transfers[transfersIndex].persistence = tx.persistence
    }
  }

  return state
}

/**
 *  @method isUsedKey
 *
 *  @ignore
 *
 *  @description
 *  Determines if a key is used by examining the used key indexes in state
 *
 *  @param {array.<int>} indexes
 *  @param {int} index
 *
 *  @return {boolean}
 */
function isUsedKey (indexes, index) {
  return indexes.findIndex(i => Array.isArray(i) ? index >= i[0] && index <= i[1] : i === index) !== -1
}

/**
 *  @method markKeyAsUsed
 *
 *  @ignore
 *
 *  @description
 *  Marks a key index as used in local state.
 *  Updates ranges or adds a new entry, if needed.
 *
 *  @param {array<int>} indexes
 *  @param {int} index
 */
function markKeyAsUsed (indexes, index) {
  if (isUsedKey(indexes, index)) return

  const getBound = (a, i) => Array.isArray(a) ? a[i] : a
  const i = indexes.findIndex(i => Array.isArray(i) ? i[0] === index + 1 : i === index + 1)
  const j = indexes.findIndex(i => Array.isArray(i) ? i[1] === index - 1 : i === index - 1)

  if (i > -1 && j > -1) {
    indexes[i] = [getBound(indexes[j], 0), getBound(indexes[i], 1)]
    indexes.splice(j, 1)
  } else if (j > -1) {
    indexes[j] = [getBound(indexes[j], 0), index]
  } else if (i > -1) {
    indexes[i] = [index, getBound(indexes[i], 1)]
  } else {
    indexes.push(index)
    indexes.sort()
  }
}

/**
 *  @method validateSignatures
 *
 *  @private
 *
 *  @description
 *  Consumes a transfers array and validates the signature for a given transaction.
 *  Returns true if signature is valid, false otherwise.
 *
 *  @param {array.<Transaction>} txs
 *  @param {Transaction} tx
 *  @param {int} signatureFragmentsLength
 *
 *  @return {Boolean}
 */
function _validateSignatures (txs, tx, signatureFragmentsLength) {
  const signatureFragments = []
  let _tx = tx

  // Get signature fragments through trunk
  for (let i = 0; i < signatureFragmentsLength; i++) {
    signatureFragments.push(_tx.signatureMessageFragment)

    _tx = txs.find(tx => tx.hash === _tx.trunkTransaction)

    if (!_tx) break
  }

  if (signatureFragments.length !== signatureFragmentsLength) {
    return false
  }

  // Validate signatures
  return signing.validateSignatures(tx.address, signatureFragments, tx.bundle)
}

/**
 *  @method _isSendingValueToInputs
 *
 *  @private
 *
 *  @description
 *  Checks if value is sent back to inputs.
 *
 *  @param {array.<Transaction>} bundle
 *
 *  @return {Boolean}
 */
function _isSendingValueToInputs (bundle) {
  const inputTxs = bundle.filter(tx => tx.value < 0)
  const outputTxs = bundle.filter(tx => tx.value > 0)

  return inputTxs.some(inputTx => outputTxs.some(outputTx => outputTx.address === inputTx.address))
}

module.exports = {
  sync,
  syncAddresses,
  syncBalances,
  getTransfersDiff,
  applyTransfersDiff,
  markKeyAsUsed,
  isUsedKey
}
