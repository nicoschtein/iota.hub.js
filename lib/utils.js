'use strict'

/**
 * Recursively copies all elements in array or object to a new clone
 * @ignore
 */
function deepClone (a) {
  let b
  if (isArray(a)) {
    let i = -1
    b = []
    while (++i < a.length) {
      b[i] = deepClone(a[i])
    }
  } else if (isObject(a)) {
    b = {}
    for (const x of Object.keys(a)) {
      b[x] = deepClone(a[x])
    }
  } else {
    b = a
  }
  return b
}

/**
 * Checks if provided arguments are Arrays
 * @ignore
 */
function isArray (...inputs) {
  for (const i of inputs) {
    if (!Array.isArray(i)) {
      return false
    }
  }
  return true
}

/**
 * Check if provided arguments are Objects
 * @ignore
 */
function isObject (...inputs) {
  for (const i of inputs) {
    if (Object.prototype.toString.call(i) !== '[object Object]') {
      return false
    }
  }
  return true
}

module.exports = {
  deepClone
}
