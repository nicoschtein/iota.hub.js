const IOTAHub = require('../index')
const Hub = IOTAHub.Hub
const { sync } = IOTAHub.sync

const hub = new Hub('https://localhost:14265')

hub.on('sweep', (txs) => {
  console.log('Sweep', txs)
})

hub.on('deposit', (tx) => {
  console.log('Deposit', tx.hash, tx.value)
})

const state = {
  addresses: [],
  inputs: [],
  transfers: [],
  indexes: [],
  lastKeyIndex: 0
}

function example () {
  console.log('Syncing...')
  sync(hub, state, {
    seed: 'SEED',
    security: 2,
    rescan: true
  })
  .then(state => {
    console.log('Addresses:', state.addresses)
    console.log('Inputs:', state.inputs)
    console.log('Used key indexes:', state.indexes)
    console.log('Transfers:', state.transfers)
    console.log('Last key index:', state.lastIndex)
  })
  .catch(err => console.log(err.stack || err))
}

example()
