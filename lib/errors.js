/**
 *  @module errors
 *
 *  @description
 *  Common errors thrown by hub methods.
 */

const errors = {
  /**
   *  @constant {string} INVALID_ARGUMENTS Invalid arguments
   */
  INVALID_ARGUMENTS: 'Invalid arguments',

  /**
   *  @constant {string} INCONSISTENT_LOCAL_STATE - Inconsistent local state
   */
  INCONSISTENT_LOCAL_STATE: 'Inconsistent local state',

  /**
   *  @constant {string} NO_INPUTS_AVAILABLE - No inputs available
   */
  NO_INPUTS_AVAILABLE: 'No inputs available',

  /**
   *  @constant {string} INSUFFICIENT_BALANCE - Insufficient balance
   */
  INSUFFICIENT_BALANCE: 'Insufficient balance',

  /**
   *  @const {string} INVALID_REMAINDER_ADDRESS - Invalid remainder address
   */
  INVALID_REMAINDER_ADDRESS: 'Invalid remainder address',

  /**
   *  @const {string} UNDEFINED_LAST_INDEX - Undefined last index
   */
  UNDEFINED_LAST_INDEX: 'Last key index not found in state'
}

module.exports = errors
