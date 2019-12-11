/**
 * Custom view API.
 */
class CustomView {
  constructor (options) {}

  /**
   * An asynchronous method invoked by the runner just before the test run begins.
   * @returns {Promise}
   */
  init () {}

  /**
   * Runner start.
   * @param {number}
   */
  start (count) {}

  /**
   * Test start
   * @param {Tom}
   */
  testStart (test) {}

  /**
   * Test passed.
   * @param {Tom}
   * @param {*}
   */
  testPass (test, result) {}

  /**
   * Test passed.
   * @param {Tom}
   * @param {*}
   */
  testFail (test, err) {}

  /**
   * Test skipped.
   * @param {Tom}
   */
  testSkip (test) {}

  /**
   * Test ignored.
   * @param {Tom}
   */
  testIgnore (test) {}

  /**
   * Test todo.
   * @param {Tom}
   */
  testTodo (test) {}

  /**
   * @params {object} stats
   * @params {object} stats.fail
   * @params {object} stats.pass
   * @params {object} stats.skip
   * @params {object} stats.start
   * @params {object} stats.end
   */
  end (stats) {}

  /**
   * Option definitions.
   * @returns {OptionDefinition[]}
   */
  static optionDefinitions () {}
}

export default CustomView
