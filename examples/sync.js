const IOTAHub = require('../index')
const Hub = IOTAHub.Hub
const { sync } = IOTAHub.sync

const hub = new Hub('http://localhost:14265')

hub.on('sweep', (tx) => {
  console.log('Sweep:', tx.hash, tx.value)
})

hub.on('deposit', (tx) => {
  console.log('Deposit:', tx.hash, tx.value)
})

const state = {
  addresses: [],
  inputs: [],
  transfers: [],
  indexes: [],
  keyIndex: 0
}

function example () {
  console.log('Syncing...')
  sync(hub, state, {
    seed: 'SEED',
    security: 2,
    rescan: true,
    enableEvents: true
  })
  .then(state => {
    console.log('Addresses:', state.addresses.sort((a, b) => a.index - b.index).map(a => a.address + ', ' + a.index + ', ' + a.balance))
    console.log('Inputs:', state.inputs)
    console.log('Transfers:', state.transfers.map(tx => tx.hash + ', ' + tx.value + ', ' + tx.persistence))
    console.log('Used key indexes:', state.indexes)
    console.log('Last key index:', state.keyIndex)
  })
  .catch(err => console.log(err.stack || err))
}

example()
