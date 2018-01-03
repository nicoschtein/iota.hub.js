'use strict'

const { deepClone } = require('./utils')
const errors = require('./errors')
const prepareTransfers = require('./prepareTransfers')
const { markKeyAsUsed } = require('./sync')
const { getNewAddress } = require('./address')
const { utils } = require('iota.crypto.js')

/**
 *  @method transfer
 *
 *  Prepares the transaction trytes and returns a new state copy.
 *
 *  @param {Hub} hub
 *  @param {State} state
 *  @param {string} seed
 *  @param {array<Transfer>} transfers
 */
function transfer (hub, state, seed, transfers) {
  const stateCopy = deepClone(state)
  const value = transfers.reduce((sum, tx) => sum + tx.value, 0)
  const { inputs, balance } = getInputs(stateCopy, value)
  const remainderAddress = balance - value ? getRemainderAddress(hub, stateCopy, seed) : null

  const txs = prepareTransfers(seed, inputs, transfers, remainderAddress)
  const trytes = txs.map(tx => utils.transactionTrytes(tx)).reverse()

  for (const input of inputs) {
    stateCopy.inputs.splice(stateCopy.inputs.findIndex(stateInput => stateInput.address === input.address), 1)

    stateCopy.addresses.push(input)

    markKeyAsUsed(stateCopy.indexes, input.index)
  }

  stateCopy.transfers.concat(txs.map(tx => ({...tx, persistence: false})))

  return { state: stateCopy, trytes }
}

/**
 *  @method sendTrytes
 *
 *  Does tip selection and attaches to tangle
 *
 *  @param {Hub} hub
 *  @param {array} trytes
 *  @param {int} depth
 *  @param {int} minWeightMagnitude
 */
function sendTrytes (hub, trytes, depth, minWeightMagnitude) {
  return hub.api.sendTrytes(trytes, depth, minWeightMagnitude)
}

function promote () {
  // WIP
}

function getInputs (state, value) {
  if (!Number.isInteger(value)) {
    throw new Error(errors.INVALID_VALUE)
  }

  const availableInputs = [...state.inputs]
    .filter(input =>
      input.balance > 0 &&
      state.transfers.findIndex(tx => tx.address === input.address && tx.value > 0 && !tx.persistence) === -1) // <- TODO: Validate the bundles

  if (availableInputs.length === 0) {
    throw new Error(errors.NO_INPUTS_AVAILABLE)
  }

  if (availableInputs.reduce((sum, input) => sum + input.balance, 0) < value) {
    throw new Error(errors.INSUFFICIENT_BALANCE)
  }

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
  transfer,
  sendTrytes,
  promote
}
