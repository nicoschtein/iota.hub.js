'use strict'

const IOTACrypto = require('iota.crypto.js')
const errors = require('./errors')

const Bundle = IOTACrypto.bundle
const signing = IOTACrypto.signing
const converter = IOTACrypto.converter
const valid = IOTACrypto.utils.inputValidator

const HASH_LENGTH = 81
const SIGNATURE_MESSAGE_FRAGMENT_LENGTH = 2187
const KEY_FRAGMENT_LENGTH = 6561

const pad = (str, l) => str + '9'.repeat(l - str.length)
const getFragment = (a, i, l) => a.slice(i * l, (i + 1) * l)
const getTag = transfer => pad((transfer.tag || transfer.obsoleteTag) || '9'.repeat(27), 27)

function prepareTransfers (seed, inputs, transfers, remainderAddress) {
  const bundle = new Bundle()
  const timestamp = Math.floor(Date.now() / 1000)
  const remainder = inputs.reduce((acc, input) => acc + input.balance, 0) - transfers.reduce((acc, transfer) => acc + transfer.value, 0)
  const signatureMessageFragments = []
  const tag = getTag(transfers[transfers.length - 1])
  let offset = 0

  if (remainder > 0 && !valid.isAddress(remainderAddress)) {
    throw new Error(errors.INVALID_REMAINDER_ADDRESS)
  }

  if (remainder < 0) {
    throw new Error(errors.INSUFFICIENT_BALANCE)
  }

  for (const transfer of transfers) {
    const fragmentsLength = Math.floor(transfer.message ? transfer.message / SIGNATURE_MESSAGE_FRAGMENT_LENGTH : 1)

    offset += fragmentsLength

    bundle.addEntry(fragmentsLength, transfer.address, transfer.value, getTag(transfer), timestamp)

    for (let i = 0; i < fragmentsLength; i++) {
      signatureMessageFragments.push(pad(getFragment(transfer.message || '', i, SIGNATURE_MESSAGE_FRAGMENT_LENGTH), SIGNATURE_MESSAGE_FRAGMENT_LENGTH))
    }
  }

  for (const input of inputs) {
    bundle.addEntry(input.security, input.address, -input.balance, tag, timestamp)
  }

  if (remainder > 0) {
    bundle.addEntry(1, remainderAddress, remainder, tag, timestamp)
  }

  bundle.finalize()
  bundle.addTrytes(signatureMessageFragments)

  const normalizedBundleHash = bundle.normalizedBundle(bundle.bundle[0].bundle)

  for (const input of inputs) {
    const key = signing.key(converter.trits(seed), input.index, input.security)

    for (let j = 0; j < input.security; j++) {
      bundle.bundle[offset++].signatureMessageFragment = converter.trytes(
        signing.signatureFragment(getFragment(normalizedBundleHash, j, HASH_LENGTH / 3), getFragment(key, j, KEY_FRAGMENT_LENGTH))
      )
    }
  }

  return bundle.bundle
}

module.exports = prepareTransfers
