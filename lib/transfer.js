'use strict'

const { deepClone } = require('./utils')
const errors = require('./errors')
const prepareTransfers = require('./prepareTransfers')
const { markKeyAsUsed } = require('./sync')
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

  for (const input of inputs) {
    if (stateCopy.addresses.findIndex(address => address.address === input.address) === -1) {
      stateCopy.addresses.push(input)
    }

    const inputIndex = stateCopy.inuts.findIndex(stateInput => stateInput.address === input.address)

    if (inputIndex > -1) {
      stateCopy.inputs.splice(inputIndex, 1)
    }

    markKeyAsUsed(stateCopy.indexes, input.index)
  }

  const remainderAddress = balance - value ? getInputWithLowestValue(stateCopy.inputs).address : null

  const txs = prepareTransfers(seed, inputs, transfers, remainderAddress)
  const trytes = txs.map(tx => utils.transactionTrytes(tx))

  stateCopy.transfers.concat(txs)

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
    .filter(input => input.balance > 0 &&
      state.transfers.findIndex(tx => tx.address === input.address && tx.value > 0 && !tx.persistence) === -1) // <- TODO: Validate the bundles

  if (availableInputs.length === 0) {
    throw new Error(errors.NO_AVAILABLE_INPUTS)
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

module.exports = {
  transfer,
  sendTrytes,
  promote
}
