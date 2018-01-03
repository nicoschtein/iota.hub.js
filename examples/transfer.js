const IOTAHub = require('../index')
const Hub = IOTAHub.Hub
const { sync } = IOTAHub.sync
const { transfer, sendTrytes } = IOTAHub.transfer

const hub = new Hub('http://localhost:14700')

const state = {
  addresses: [],
  inputs: [],
  transfers: [],
  indexes: [],
  keyIndex: 0
}

const seed = 'SEED'

console.log('Syncing...')

// Synchronize local state with ledger state
sync(hub, state, seed, {
  security: 2,
  rescan: true
})

// Transfer only if hub is synced
.then(state => {
  console.log('Preparing transfers...')

  return transfer(hub, state, seed, [
    { // Transfer object
      address: 'IMMYZXWKLKVGEHJIUZLBNJJTOXBQWLLDIOIJKXTGWUFECLKCLKEVVCWQYKTCLENSPPVQIWKNXR99JGAAT',
      value: 1
    }
  ])
})

// Returns a new state copy and transaction trytes
.then(({ state, trytes }) => {
  console.log('Inputs:', state.inputs) // Inputs no longer contains the ones used in transfer
  console.log('Addresses:', state.address) // Used inputs were moved to addresses
  console.log('Transfers:', state.transfer) // Transafers were added to state
  console.log('Transaction trytes:', trytes) // Transaction trytes

  console.log('Attaching to tangle...')

  // Attach to tangle and broadcast transactions
  return sendTrytes(trytes, 3, 14) // Use depth 3, minWeightMagnitude 14
})

// lists attached transactions
.then(txs => console.log('Attached transactions:', txs))

// Handle errors
.catch(err => console.log(err.stack || err))
