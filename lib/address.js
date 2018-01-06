'use strict'

const { utils } = require('iota.crypto.js')
const errors = require('./errors')

/**
 *  @module address
 *
 *  @description Securely generate new deposit addresses.
 */

/**
 *  @method getNewAddress
 *
 *  @description
 *  Generates a new address by incrementing `state.keyIndex` and mutates the [`state`]{@link State}.
 *
 *  > **NOTICE:**
 *  >
 *  > Always provide an up-to-date [`state`]{@link State} that contains the latest key index.
 *
 *  @param {Hub} hub - Hub instance
 *  @param {State} state - State object
 *  @param {string} seed - Seed
 *  @param {int} [security=2] - Security level, can be 1, 2 or 3
 *  @param {boolean} [checksum=false] - Flag to include checksum
 *
 *  @return {object} Returns the updated [`state`]{@link State} and the new `address` as 81-trytes `string`.
 */
function getNewAddress (hub, state, seed, security = 2, checksum = true) {
  if (!state.keyIndex) {
    return new Error(errors.UNDEFINED_LAST_INDEX)
  }

  // Generate new address and increment key index
  const address = hub.api.getAddress(seed, state.keyIndex++, security, checksum)

  // Add address to state
  state.addresses.push(utils.noChecksum(address))

  return { state, address }
}

module.exports = {
  getNewAddress
}
