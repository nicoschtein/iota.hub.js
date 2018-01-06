'use strict'

const IOTA = require('iota.lib.js')
const promisify = require('pify')
const EventEmitter = require('events')

/**
 *  @class Hub
 *
 *  @constructor
 *
 *  @description Creates a hub instance and connects to a node
 *
 *  @param {string} provider - IOTA API provider uri (default: http://localhost:14265)
 */
class Hub extends EventEmitter {
  constructor (provider) {
    /** Extends event emitter and fires events uppon transaction confirmation. */

    /**
     *  _Confirmed_ transction depositing to an address.
     *  Passes the {@link Transaction transaction} object as first argument.
     *
     *  @event Hub#deposit
     *
     *  @type {object}
     *  @prop {string} hash - Transaction hash
     *  @prop {string} address - Address
     *  @prop {int} value - Value
     *  @prop {string} tag - 27-trytes tag
     *  @prop {int} timestamp - Timestamp
     */

    /**
     *  _Confirmed_ transction sweeping tokens from an address.
     *  Passes the {@link Transaction transaction} object as first argument.
     *
     *  @event Hub#sweep
     *
     *  @type {object}
     *  @prop {string} hash - Transaction hash
     *  @prop {string} address - Address
     *  @prop {int} value - Value
     *  @prop {string} tag - 27-trytes tag
     *  @prop {int} timestamp - Timestamp
     */

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
