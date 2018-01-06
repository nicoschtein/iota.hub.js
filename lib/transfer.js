'use strict'

const { deepClone } = require('./utils')
const { markKeyAsUsed } = require('./sync')
const { getNewAddress } = require('./address')
const { utils } = require('iota.crypto.js')
const errors = require('./errors')
const _prepareTransfers = require('./prepareTransfers')

/**
 *  @typedef {object} Transfer - Transfer object
 *  @prop {string} address - Destination address
 *  @prop {int} value - Value to send in iotas
 *  @prop {string} [tag] - Optional 27-trytes tag
 *  @prop {string} [message] - Optional tryte-encoded message
 */

/** @module transfer
 *
 *  @description Utilities for executing transactions.
 *
 *  @todo Implement reattachments and promotion.
 */

/**
 *  @method prepareTransfers
 *
 *  @todo Validate the bundles of pending transactions that send to inputs.
 *  @todo Allow spending from change address to speedup tranfers.
 *  @todo Add option to batch transactions into separate bundles.
 *
 *  @description
 *  Prepares the transactions trytes and updates the [`state`]{@link State}.
 *
 *  > **NOTICE:**
 *  >
 *  > Use this method _only if hub is synced_. Use [`sync()`]{@link sync} to synchronize the hub.
 *
 *  > **TIP:**
 *  >
 *  > Use [`sendTrytes()`]{@link sendTrytes} to attach the returned `trytes` to tangle.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object
 *  @param {string} seed - Seed
 *  @param {array<Transfer>} transfers - Transfer objects
 *
 *  @return {object} Returns an `object` of the updated [`state`]{@link State} and `array` of the transaction `trytes`.
 */
function prepareTransfers (hub, state, seed, transfers) {
  const stateCopy = deepClone(state)
  const value = transfers.reduce((sum, tx) => sum + tx.value, 0)
  const { inputs, balance } = getInputs(stateCopy, value)
  const remainderAddress = balance - value ? getRemainderAddress(hub, stateCopy, seed) : null

  const txs = _prepareTransfers(seed, inputs, transfers, remainderAddress)
  const trytes = txs.map(tx => utils.transactionTrytes(tx)).reverse()

  // Update the state
  for (const input of inputs) {
    // Remove used inputs
    stateCopy.inputs.splice(stateCopy.inputs.findIndex(stateInput => stateInput.address === input.address), 1)

    // Append used inputs to addresses list
    stateCopy.addresses.push(input)

    // Add used key index in state
    markKeyAsUsed(stateCopy.indexes, input.index)
  }

  // Append the transaction objects to state
  stateCopy.transfers.concat(txs.map(tx => ({...tx, persistence: false})))

  return { state: stateCopy, trytes }
}

/**
 *  @method sendTrytes
 *
 *  @description
 *  Does tip selection, attaches to tangle, broadcasts transactions and updates the [`state`]{@link State}.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object
 *  @param {array} trytes - Trytes array
 *  @param {int} depth - Depth
 *  @param {int} minWeightMagnitude - Min weight magnitude
 *
 *  @return {Promise<Object|Error>} Returns `promise` which resolves to updated [`state`]{@link State} and attached transaction objects.
 */
function sendTrytes (hub, state, trytes, depth, minWeightMagnitude) {
  return hub.api.sendTrytes(trytes, depth, minWeightMagnitude)
    .then(txs => {
      const stateCopy = deepClone(state)

      for (const tx of txs) {
        // Find transaction index in state
        const i = stateCopy.transfers
          .findIndex(_tx => !_tx.hash && _tx.address === tx.address && _tx.bundle === tx.bundle)

        // Update the transfers list
        if (i > -1) {
          stateCopy.transfers[i] = { ...tx, persistence: false }
        } else { // Append if transaction is missing from state
          stateCopy.transfers.push({ ...tx, persistence: false })
        }
      }

      return {
        state: stateCopy,
        transactions: deepClone(txs)
      }
    })
}

function reattach () {
  // WIP
}

function promote () {
  // WIP
}

function getInputs (state, value) {
  if (!Number.isInteger(value)) {
    throw new Error(errors.INVALID_VALUE)
  }

  // Use inputs with no pending balance
  // TODO: Use getBalances() with `reference` option to speed things up
  const availableInputs = [...state.inputs]
    .filter(input => input.balance > 0 &&
      state.transfers
        .findIndex(tx => tx.address === input.address && tx.value > 0 && !tx.persistence) === -1 // <- TODO: Validate the bundles
    )

  if (availableInputs.length === 0) {
    throw new Error(errors.NO_INPUTS_AVAILABLE)
  }

  if (availableInputs.reduce((sum, input) => sum + input.balance, 0) < value) {
    throw new Error(errors.INSUFFICIENT_BALANCE)
  }

  // Use as less inputs as possible
  const byOptimalValue = (a, b, diff) => Math.abs(diff - a.balance) - Math.abs(diff - b.balance)
  const collectedInputs = []
  let totalBalance = 0

  while (totalBalance < value) {
    availableInputs.sort((a, b) => byOptimalValue(a, b, value - totalBalance))

    const input = availableInputs.shift()

    collectedInputs.push(input)

    totalBalance += input.balance
  }

  return {
    inputs: collectedInputs,
    balance: totalBalance
  }
}

function getInputWithLowestValue (inputs) {
  return [...inputs].sort((a, b) => a.balance - b.balance)[0]
}

function getRemainderAddress (hub, state, seed, security = 2) {
  const input = getInputWithLowestValue(state.inputs)

  if (!input) {
    return getNewAddress(hub, state, seed, security, false).address
  }

  return input.address
}

module.exports = {
  prepareTransfers,
  sendTrytes,
  promote,
  reattach
}
