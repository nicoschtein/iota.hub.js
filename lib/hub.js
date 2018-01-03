'use strict'

const IOTA = require('iota.lib.js')
const promisify = require('pify')
const EventEmitter = require('events')

/**
 *  @class Hub
 *
 *  @constructor
 *  @param {string} provider IOTA API provider uri (default: http://localhost:14265)
 */
class Hub extends EventEmitter {
  constructor (provider) {
    super()

    if (!provider) {
      provider = 'http://localhost:14265'
    }

    const iota = new IOTA({provider})

    this.api = {
      getAddress: iota.api._newAddress,
      getNewAddress: promisify(iota.api.getNewAddress).bind(iota.api),
      findTransactionObjects: promisify(iota.api.findTransactionObjects).bind(iota.api),
      getBalances: promisify(iota.api.getBalances).bind(iota.api),
      getLatestInclusion: promisify(iota.api.getLatestInclusion).bind(iota.api),
      sendTrytes: promisify(iota.api.sendTrytes).bind(iota.api)
    }
  }
}

module.exports = Hub
