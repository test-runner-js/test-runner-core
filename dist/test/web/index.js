'use strict';

function raceTimeout (ms, msg) {
  return new Promise((resolve, reject) => {
    const interval = setTimeout(() => {
      const err = new Error(msg || `Timeout expired [${ms}]`);
      reject(err);
    }, ms);
    if (interval.unref) interval.unref();
  })
}

/**
 * Test function class.
 * @param {string} name
 * @param {function} testFn
 * @param {object} options
 * @param {number} options.timeout
 */
class Test {
  constructor (name, testFn, options) {
    this.name = name;
    this.testFn = testFn;
    this.id = 1;
    this.options = Object.assign({ timeout: 10000 }, options);
  }

  /**
   * Execute the stored test function.
   * @returns {Promise}
   */
  run () {
    const testFnResult = new Promise((resolve, reject) => {
      try {
        const result = this.testFn.call(new TestContext({
          name: this.name,
          id: this.id
        }));
        if (result && result.then) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    });

    return Promise.race([ testFnResult, raceTimeout(this.options.timeout) ])
  }
}

/**
 * The test context, available as `this` within each test function.
 */
class TestContext {
  constructor (context) {
    this.name = context.name;
    this.id = context.id;
  }
}

function testSuite (assert) {
  const tests = [];

  tests.push(function (assert) {
    const test = new Test('passing sync test', () => true);
    return test.run()
      .then(result => {
        assert(result === true);
      })
      .catch(err => {
        console.log(err);
        assert(false, 'should not reach here');
      })
  });

  tests.push(function (assert) {
    const test = new Test('failing sync test', function () {
      throw new Error('failed')
    });
    return test.run()
      .then(() => {
        assert(false, "shouldn't reach here");
      })
      .catch(err => {
        assert(/failed/.test(err.message));
      })
  });

  tests.push(function (assert) {
    const test = new Test('passing async test', function () {
      return Promise.resolve(true)
    });
    return test.run().then(result => {
      assert(result === true);
    })
  });

  tests.push(function (assert) {
    const test = new Test('failing async test: rejected', function () {
      return Promise.reject(new Error('failed'))
    });
    return test.run()
      .then(() => {
        assert(false, "shouldn't reach here");
      })
      .catch(err => {
        assert(/failed/.test(err.message));
      })
  });

  tests.push(function (assert) {
    const test = new Test(
      'failing async test: timeout',
      function () {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 300);
        })
      },
      { timeout: 150 }
    );
    return test.run()
      .then(() => assert(false, 'should not reach here'))
      .catch(err => {
        assert(/Timeout expired/.test(err.message));
      })
  });

  tests.push(function (assert) {
    const test = new Test(
      'passing async test: timeout 2',
      function () {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve('ok'), 300);
        })
      },
      { timeout: 350 }
    );
    return test.run()
      .then(result => {
        assert(result === 'ok');
      })
      .catch(err => {
        console.log(err);
        assert(false, 'should not reach here');
      })
  });

  return Promise.all(tests.slice(0, 1).map(t => t(assert)))
}

function testSuite$1 (assert, TestRunner, view) {
  const tests = [];

  tests.push(function (assert) {
    const runner = new TestRunner({ name: 'runner.start: one test', view });
    runner.test('simple', function () {
      assert(this.name === 'simple');
      return true
    });
    return runner.start()
      .then(results => {
        assert(results[0] === true);
      })
  });

  tests.push(function (assert) {
    const runner = new TestRunner({ name: 'runner.start: two tests', view });
    runner.test('simple', function () {
      assert(this.id === 1);
      return true
    });
    runner.test('simple 2', function () {
      assert(this.id === 2);
      return 1
    });
    return runner.start()
      .then(results => {
        assert(results[0] === true);
        assert(results[1] === 1);
      })
  });

  return Promise.all(tests.map(t => t(assert)))
}

/**
 * Make an object observable.
 * @module obso
 * @example
 * import Emitter from './node_modules/obso/emitter.mjs'
 *
 * class Something extends Emitter {}
 * const something = new Something()
 * something.on('load', () => {
 *   console.log('load event fired.')
 * })
 */

/**
 * @alias module:obso
 */
class Emitter {
  /**
   * Emit an event.
   * @param eventName {string} - the event name to emit
   * @param ...args {*} - args to pass to the event handler
   */
  emit (eventName, ...args) {
    if (this._listeners && this._listeners.length > 0) {
      const toRemove = [];
      this._listeners.forEach(listener => {
        if (listener.eventName === eventName) {
          listener.handler.apply(this, args);
        } else if (listener.eventName === '__ALL__') {
          const handlerArgs = args.slice();
          handlerArgs.unshift(eventName);
          listener.handler.apply(this, handlerArgs);
        }
        if (listener.once) toRemove.push(listener);
      });
      toRemove.forEach(listener => {
        this._listeners.splice(this._listeners.indexOf(listener), 1);
      });
    }
    if (this.parent) this.parent.emit(eventName, ...args);
  }

   /**
    * Register an event listener.
    * @param eventName {string} - the event name to watch
    * @param handler {function} - the event handler
    */
  on (eventName, handler, options) {
    createListenersArray(this);
    options = options || {};
    if (arguments.length === 1 && typeof eventName === 'function') {
      this._listeners.push({ eventName: '__ALL__', handler: eventName, once: options.once });
    } else {
      this._listeners.push({ eventName: eventName, handler: handler, once: options.once });
    }
  }

  /**
   * Remove an event listener.
   * @param eventName {string} - the event name
   * @param handler {function} - the event handler
   */
  removeEventListener (eventName, handler) {
    if (!this._listeners || this._listeners.length === 0) return
    const index = this._listeners.findIndex(function (listener) {
      return listener.eventName === eventName && listener.handler === handler
    });
    if (index > -1) this._listeners.splice(index, 1);
  }

  once (eventName, handler) {
    this.on(eventName, handler, { once: true });
  }

  propagate (eventName, from) {
    from.on(eventName, (...args) => this.emit(eventName, ...args));
  }
}

/* alias */
Emitter.prototype.addEventListener = Emitter.prototype.on;

function createListenersArray (target) {
  if (target._listeners) return
  Object.defineProperty(target, '_listeners', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: []
  });
}

/**
 * @module test-runner
 */

class DefaultView {
  start (count) {
    console.log(`Starting: ${count} tests`);
  }
  testPass (test, result) {
    console.log('✅', test.name, result || 'ok');
  }
  testFail (test, err) {
    console.error('🛑', test.name, err);
  }
}

/**
 * @alias module:test-runner
 * @emits start
 * @emits end
 * @emits test-start
 * @emits test-end
 * @emits test-pass
 * @emits test-fail
 */
class TestRunner extends Emitter {
  constructor (options) {
    super();
    this.options = options || {};
    this.state = 0;
    this._id = 1;
    this.name = options.name;
    this.tests = [];
    this._only = [];
    this.view = options.view || new DefaultView();
    if (this.view.start) this.on('start', this.view.start.bind(this.view));
    if (this.view.testPass) this.on('test-pass', this.view.testPass.bind(this.view));
    if (this.view.testFail) this.on('test-fail', this.view.testFail.bind(this.view));
    if (this.view.testSkip) this.on('test-skip', this.view.testSkip.bind(this.view));
    this.init();
  }

  init () {
    if (!this.options.manualStart) {
      process.setMaxListeners(Infinity);
      process.on('beforeExit', () => {
        this.start();
      });
    }
  }

  test (name, testFn, options) {
    const test = new Test(name, testFn, options);
    this.tests.push(test);
    test.id = this.tests.length;
    return test
  }

  skip (name, testFn, options) {
    const test = this.test(name, testFn, options);
    test.skip = true;
    return test
  }

  only (name, testFn, options) {
    const test = this.test(name, testFn, options);
    this._only.push(test);
    return test
  }

  /**
   * Run all tests in parallel
   */
  start () {
    if (this.state !== 0) return
    this.state = 1;
    if (this._only.length) {
      for (const test of this.tests) {
        if (this._only.indexOf(test) === -1) test.skip = true;
      }
    }
    const tests = this.tests;
    this.emit('start', tests.length);
    return Promise
      .all(tests.map(test => {
        if (test.skip) {
          this.emit('test-skip', test);
        } else {
          this.emit('test-start', test);
          return test.run()
            .then(result => {
              this.emit('test-pass', test, result);
              this.emit('test-end', test, result);
              return result
            })
            .catch(err => {
              this.emit('test-fail', test, err);
              this.emit('test-end', test, err);
              throw err
            })
        }
      }))
      .then(results => {
        this.state = 2;
        this.emit('end');
        return results
      })
      .catch(err => {
        process.exitCode = 1;
        this.state = 2;
        this.emit('end');
        throw err
      })
  }
}

/**
 * @module test-runner-web
 */

/**
 * @alias module:test-runner-web
 */
class TestRunnerWeb extends TestRunner {
  init () {
    if (!this.options.manualStart) {
      window.onload = () => {
        this.start();
      };
    }
  }
}

const π = document.createElement.bind(document);
const $ = document.querySelector.bind(document);

class WebView extends HTMLElement {
  connectedCallback () {
  }
  start (count) {
    const li = π('li');
    li.textContent = `1..${count}`;
    this.appendChild(li);
  }
  testPass (test) {
    const li = π('li');
    li.textContent = `ok ${test.id} ${test.name}`;
    this.appendChild(li);
  }
  testFail (test) {
    const li = π('li');
    li.textContent = `not ok ${test.id} ${test.name}`;
    this.appendChild(li);
  }
}

customElements.define('web-view', WebView);

const view = new WebView();
$('body').appendChild(view);

testSuite(console.assert)
  .then(function () {
    return testSuite$1(console.assert, TestRunnerWeb, view)
  })
  .catch(function (err) {
    console.error(err);
  });
