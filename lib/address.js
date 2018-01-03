'use strict'

const { utils } = require('iota.crypto.js')

/**
 *  @method getNewAddress
 *
 *  Increments lastKeyIndex in state and creates new address.
 *  Returns the updated state and the new address.
 *
 *  @param {Hub} hub
 *  @param {State} state
 *  @param {string} seed
 *  @param {int} security
 *  @param {boolean} checksum
 *
 *  @return {object}
 */
function getNewAddress (hub, state, seed, security = 2, checksum = true) {
  if (!state.keyIndex) {
    return new Error('Last key index not found in state')
  }

  const address = hub.api.getAddress(seed, state.keyIndex++, security, checksum)

  state.addresses.push(utils.noChecksum(address))

  return { state, address }
}

module.exports = {
  getNewAddress
}
