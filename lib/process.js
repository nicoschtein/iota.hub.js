'use strict'

const { deepClone } = require('./utils')
const { isKeyUsed } = require('./sync')
const { getNewAddress } = require('./address')
const _prepareTransfers = require('./prepareTransfers')
const { utils } = require('iota.crypto.js')

/**
 *  @module process
 *
 *  @description Sweeps tokens from spent addresses.
 */

/**
 *  @method sweep
 *
 *  @todo Validate the bundles of pending sweep transactions.
 *
 *  @description
 *  Sweeps value from used addresses to new ones, by preparing the transaction trytes in batches.
 *  Updates the [`state`]{@link State}.
 *
 *  > **NOTICE:**
 *  >
 *  > Use this method _only if hub is synced_. Use [`sync()`]{@link sync} to synchronize the hub.
 *
 *  > **TIP:**
 *  >
 *  > Use [`sendTrytes()`]{@link sendTrytes} _for each batch_ to attach the returned `trytes` to tangle.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State
 *  @param {string} seed - Seed
 *  @param {object} [options] - Options
 *  @param {int} [options.security=2] - Security level
 *  @param {int} [options.inputsPerBundle=4] - Inputs per bundle
 *  @param {int} [options.balanceThreshold=0] - Balance threshold
 *
 *  @return {object} Returns an `object` of the updated [`state`]{@link State} and `array` of transaction `trytes`.
 */
function sweep (hub, state, seed, { security = 2, inputsPerBundle = 4, balanceThreshold = 0 }) {
  // Find previously spent addresses with balance
  const addresses = state.addresses
    .filter(address => isKeyUsed(state.indexes, address.index) && address.balance > balanceThreshold &&
      state.transfers.findIndex(tx => tx.address === address && tx.value < 0 && !tx.persistence) === -1) // TODO: validate the bundles

  // Stop if there are no addresses to sweep
  if (!addresses.length) {
    return { state, trytes: [] }
  }

  // Sweep tokens to a new address
  const { stateCopy, newAddress } = getNewAddress(hub, deepClone(state), seed, security, false)

  // Prepare the sweep trasfers
  const txs = []

  while (addresses.length) {
    const inputs = addresses.splice(0, inputsPerBundle)

    txs.push(
      _prepareTransfers(seed, inputs, {
        address: newAddress.address,
        value: inputs.reduce((sum, input) => sum + input.balance, 0)
      })
    )
  }

  // Add transfers to state
  stateCopy.transfers.concat(
    txs.reduce((acc, txs) => acc.concat(txs), []).map(tx => ({ ...tx, persistence: false }))
  )

  // Return the new state and transaction trytes
  return {
    state: stateCopy,
    trytes: txs.map(txs => txs.map(tx => utils.transactionTrytes(tx)).reverse())
  }
}

module.exports = {
  sweep
}
