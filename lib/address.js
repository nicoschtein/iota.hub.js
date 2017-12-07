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
 *  @param {object} options
 *  @param {string} options.seed
 *  @param {int} options.security
 *  @param {boolean} options.checksum
 *
 *  @return {object}
 */
function getNewAddress (hub, state, {seed, security = false, checksum = true}) {
  if (!state.lastKeyIndex) {
    return new Error('Last key index not found in state')
  }

  const address = hub.api._newAddress(seed, ++state.lastIndex, security, checksum)

  state.addresses.push(utils.noChecksum(address))

  return {state, address}
}

module.exports = {
  getNewAddress
}
