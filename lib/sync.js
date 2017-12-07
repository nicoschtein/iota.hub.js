'use strict'

const { signing, utils } = require('iota.crypto.js')
const { deepClone } = require('./utils')
const errors = require('./errors')

/**
 *  @method sync
 *
 *  Syncronizes the hub with the current ledger state.
 *  - Generates addresses that are not present in local state.
 *  - Updates balances of addresses and inputs in state.
 *  - Fetches and applies transfers diff in local state.
 *    Updates persistence and categorizes addresses and inputs based on the diff.
 *    A diff consists of transactions not present in local state,
 *    and/or confirmed transactions that were marked as pending localy.
 *  - Prevents key reuse based on used key indexes, which should be present in the local state.
 *  - Emits events uppon confirmation of each deposit or sweep transaction.
 *  - Categorizes unspent addresses with balance as inputs.
 *
 *  - Returns a new copy of the state object wich is even with the state of ledger.
 *
 *  > **(!) IMPORTANT NOTICE:**
 *  >
 *  > Sync does no rely solely on full node database, which is being erased with snapshots.
 *  > The ledger is being queried to fetch the most recent state, however security relies
 *  > on local state containing all used key indexes.
 *
 *  @param {Hub} hub Hub instance
 *  @param {State} state State object to hold the hub data
 *  @param {object} options Options
 *  @param {string} options.seed Seed associated to the address of the hub
 *  @param {int} options.security Security level of addresses
 *  @param {boolean} options.rescan If true, sync fetches the entire transactions history
 *  @param {boolean} options.enableEvents Flag to enable deposit events
 *  @return {Promise<State|Error>} Returns a promise wich resolves to the synchronized state
 */
function sync (hub, state, {seed, security = 2, rescan = true, enableEvents = false}) {
  if (!seed) {
    throw new Error(errors.INVALID_ARGUMENTS)
  }

  // Don't mutate original state object
  const stateCopy = deepClone(state)

  // If we rescan fetch new addresses and return a new state
  return (rescan ? syncAddresses(hub, stateCopy, seed, security) : Promise.resolve(stateCopy))

    // Sync balances of all addresses and inputs in new state
    .then(state => syncBalances(hub, state))

    // Scan for transactions and generate a diff between ledger and local state
    .then(state => getTransfersDiff(hub, state, rescan)

      // Apply the transfer diff to the local state
      .then(diff => applyTransfersDiff(state, diff, enableEvents ? hub : null))
    )
}

/**
 *  @method syncAddresses
 *
 *  Scans for transactions associated to addresses above the next index
 *  and adds all new addresses in local state.
 *
 *  @param {Hub} hub Hub instance
 *  @param {State} state State object
 *  @param {string} seed Seed associated to the addresses of the hub
 *  @param {int} security Security level of addresses
 *  @return {Promise<State|Error>}
 */
function syncAddresses (hub, state, seed, security = 2) {
  // Get next key index
  const index = state.keyIndex

  // Fetch all used addresses starting from selected index
  return hub.api.getNewAddress(seed, {index, security, returnAll: true, checksum: false})

    .then(newAddresses => {
      // Construct address objects and add them in state
      state.addresses = state.addresses.concat(newAddresses.slice(0, -1).map((address, i) => ({address, index: index + i, security})))

      // Update state with new last key index
      if (newAddresses.length) {
        state.keyIndex += newAddresses.length - 1
      }

      return state
    })
}

/**
 *  @method syncBalances
 *
 *  Updates balances of all addresses and inputs in state.
 *
 *  @param {Hub} hub Hub instance
 *  @param {State} state State object
 *  @return {Promise<State|Error>}
 */
function syncBalances (hub, state) {
  // Fetch balances of all inputs and addresses
  return hub.api.getBalances(state.addresses.concat(state.inputs).map(address => address.address), 100)
    .then(res => {
      const l = state.addresses.length // inputs offset in concatenated array

      // Update the balance in local state
      res.balances.forEach((balance, i) => {
        state[i < l ? 'addresses' : 'inputs'][i < l ? i : i - l].balance = parseInt(balance)
      })

      return state
    })
}

/**
 *  @method getTransfersDiff
 *
 *  Constructs a transfers diff between local and ledger state.
 *
 *  @param {Hub} hub Hub instance
 *  @param {State} state State object
 *  @param {boolean} rescan Rescan complete transfer history
 *  @return {Promise.<array>}
 */
function getTransfersDiff (hub, state, rescan = true) {
  // Construct queries to fetch potential transfers diff
  return (rescan

    // If we rescan, find transactions of all addresses and inputs in state
    ? hub.api.findTransactionObjects({addresses: state.addresses.concat(state.inputs).map(address => address.address)})

      // Filter out confirmed txs that exist in local state
      .then(txs => txs.filter(tx => state.transfers.indexOf(stateTx => stateTx.hash === tx.hash && !stateTx.persistence) === -1))

    // Otherwise extract unconfirmed transfers from local state
    : Promise.resolve(state.transfers.filter(tx => !tx.persistence)))

      // Fetch inclusion states
      .then(txs => hub.api.getLatestInclusion(txs.map(tx => tx.hash))

        // Map inclusion states to transfers list
        .then(inclusionStates => txs.map((tx, i) => ({...tx, persistence: inclusionStates[i]})))
      )

      // Filter out txs that are even with local state
      .then(txs => txs.filter(tx => state.transfers.indexOf(stateTx => stateTx.hash === tx.hash && stateTx.persistence !== tx.persistenece) === -1))
}

/**
 *  @method applyTransfersDiff
 *
 *  Applies a transfers diff to local state.
 *  Adds new transfers in state, updates inclusion states and marks any
 *  used inputs as addresses.
 *
 *  @param {State} state State object
 *  @param {array} diff State diff
 *  @param {object} eventEmitter Event emitter
 *  @param {Promise<State|Error>}
 */
function applyTransfersDiff (state, diff, eventEmitter) {
  const diffCopy = [...diff].filter(tx => tx.value <= 0) // Diff copy used to validate the signatures
  const seenSpentAddresses = new Set() // Set of seen spent addresses used for skipping extra validations

  // Process spending transactions
  for (const tx of diff.filter(tx => tx.value < 0)) {
    const signatureFragmentsLength = state.addresses.find(address => address.address === tx.address).security

    // Check if signature is valid and correspending address was marked as spent
    if (!seenSpentAddresses.has(tx.address) && (tx.persistence || validateSignatures(diffCopy, tx, signatureFragmentsLength))) {
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
  for (const input of state.addresses.filter(address => address.balance > 0 && !isUsedKey(state.indexes, address.index))) {
    const addressIndex = state.addresses.findIndex(address => address.address === input.address)

    state.inputs.push(state.addresses.splice(addressIndex, 1).pop())
  }

  // Dispatch deposit events
  if (eventEmitter) {
    const sweeps = new Set() // Set of sweep bundle hashes

    for (const tx of diff.filter(tx => tx.value > 0 && tx.persistence)) {
      // Attempt to get all txs in bundle from diff
      const bundle = [...diff].filter(diffTx => diffTx.bundle === tx.bundle && diffTx.persistence)

      // Check if is sweep transfer
      if (bundle.length - 1 === tx.lastIndex && !sweeps.has(tx.bundle)) {
        // Ensure that bundle is valid and value is not send back to inputs
        if (utils.isBundle(bundle) && !isSendingValueToInputs(bundle)) {
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

  // Update transaction objects in state
  for (const tx of diff) {
    // Check if transfer exists in local state
    const transfersIndex = state.transfers.indexOf(stateTx => stateTx.hash === tx.hash)

    // Copy untracked transfers to state
    if (transfersIndex === -1) {
      state.transfers.push(tx)
    } else if (tx.persistence !== state.transfers[transfersIndex].persistence) { // Outdated persistence
      state.transfers[transfersIndex].persistence = tx.persistence
    }
  }

  return state
}

/**
 *  @method validateSignatures
 *
 *  Consumes a transfers array and validates the signature for a given transaction.
 *  Returns true if signature is valid, false otherwise.
 *
 *  @param {array.<Transaction>} txs
 *  @param {Transaction} tx
 *  @param {int} signatureFragmentsLength
 *  @return {Boolean}
 */
function validateSignatures (txs, tx, signatureFragmentsLength) {
  const txsToValidate = []

  // Collect transactions containing the signature fragments
  txs = txs.filter(_tx => {
    if (_tx.address === tx.address && _tx.bundle === tx.bundle) {
      if (txsToValidate.indexOf(seenTx => seenTx.currentIndex === tx.currentIndex) === -1) {
        txsToValidate.push(_tx)
      }

      return false
    }

    return true
  })

  // Order transactions by currentIndex and get the signature fragments
  const fragments = txsToValidate.sort((a, b) => a.currentIndex - b.currentIndex).map(tx => tx.signatureMessageFragment)

  if (fragments.length !== signatureFragmentsLength) {
    return false
  }

  // Valid signatures
  return signing.validateSignatures(tx.address, fragments, tx.bundle)
}

function isSendingValueToInputs (bundle) {
  const inputTxs = bundle.filter(tx => tx.value < 0)
  const outputTxs = bundle.filter(tx => tx.value > 0)

  return inputTxs.some(inputTx => outputTxs.some(outputTx => outputTx.address === inputTx.address))
}

/**
 *  @method isUsedKey
 *
 *  Determines if a key is used by examining the used key indexes in state
 *
 *  @param {array.<int|keyRange>} indexes
 *  @param {int} index
 */
function isUsedKey (indexes, index) {
  return indexes.findIndex(i => Array.isArray(i) ? index >= i[0] && index <= i[1] : i === index) !== -1
}

/**
 *  @method markKeyAsUsed
 *
 *  Marks a key index as used in local state.
 *  Updates ranges or adds a new entry, if needed.
 *
 *  @param {array<int|keyRange>} indexes
 *  @param {int} index
 */
function markKeyAsUsed (indexes, index) {
  if (!index || !indexes || isUsedKey(indexes, index)) {
    return false
  }

  // Get ranges array from indexes
  const ranges = [...indexes].filter(i => Array.isArray(indexes) ? indexes[0] === index + 1 || indexes[1] === index - 1 : false)
  if (ranges.length === 1) {
    const rangeIndex = indexes.findIndex(ranges[0])

    if (ranges[0] === index - 1) {
      indexes[rangeIndex] = ranges[0] === (index - 1) ? [index, ranges[0][1]] : [ranges[0][0], index]
    }
  } else if (ranges.length === 2) {
    indexes = indexes.filter(range => ranges.indexOf(range) !== -1)

    ranges.sort()

    indexes.push([ranges[0][0], ranges[1][1]])
  } else if (ranges.length === 0 && indexes.indexOf(index) === -1) {
    const i = indexes.findIndex(i => i === index - 1 || i === index + 1)

    if (i !== -1) {
      indexes[i] = [i, index].sort()
    } else {
      indexes.push(index)

      indexes.sort()
    }
  }
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
