(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.TestRunner = factory());
}(this, (function () { 'use strict';

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
   * @param {object} [options]
   * @param {number} [options.timeout]
   */
  class Test {
    constructor (name, testFn, options) {
      this.name = name;
      this.testFn = testFn;
      this.index = 1;
      this.options = Object.assign({ timeout: 10000 }, options);
      this.state = 'pending';
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
            index: this.index
          }));
          this.state = 'passed';
          if (result && result.then) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (err) {
          this.state = 'failed';
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
      this.index = context.index;
    }
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

  class ViewBase {
    constructor () {
      this._callback = {
        start: this.start.bind(this),
        end: this.end.bind(this),
        testPass: this.testPass.bind(this),
        testFail: this.testFail.bind(this),
        testSkip: this.testSkip.bind(this)
      };
    }

    attach (runner) {
      if (this.attachedTo !== runner) {
        runner.on('start', this._callback.start);
        runner.on('end', this._callback.end);
        runner.on('test-pass', this._callback.testPass);
        runner.on('test-fail', this._callback.testFail);
        runner.on('test-skip', this._callback.testSkip);
        this.attachedTo = runner;
      }
    }

    detach () {
      if (this.attachedTo) {
        this.attachedTo.removeEventListener('start', this._callback.start);
        this.attachedTo.removeEventListener('end', this._callback.end);
        this.attachedTo.removeEventListener('test-pass', this._callback.testPass);
        this.attachedTo.removeEventListener('test-fail', this._callback.testFail);
        this.attachedTo.removeEventListener('test-skip', this._callback.testSkip);
        this.attachedTo = null;
      }
    }

    start (count) {
      throw new Error('not implemented')
    }
    end (count) {
      throw new Error('not implemented')
    }
    testPass (test, result) {
      throw new Error('not implemented')
    }
    testFail (test, err) {
      throw new Error('not implemented')
    }
    testSkip (test) {
      throw new Error('not implemented')
    }
  }

  /**
   * @module test-runner
   */

  class ConsoleView extends ViewBase {
    start (count) {
      console.log(`Starting: ${count} tests`);
    }
    testPass (test, result) {
      console.log('✓', test.name, result || 'ok');
    }
    testSkip (test) {
      console.log('-', test.name);
    }
    testFail (test, err) {
      console.log('⨯', test.name);
      console.log(err);
    }
    end () {
      console.log(`End`);
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
      options = options || {};
      this.options = options;
      this.state = 0;
      this.name = options.name;
      this.tests = [];
      this._only = [];
      this.view = options.view || new ConsoleView();
      this._beforeExitCallback = this.beforeExit.bind(this);
      this.autoStart = !options.manualStart;
    }

    set autoStart (val) {
      this._autoStart = val;
      if (val) {
        process.setMaxListeners(Infinity);
        process.on('beforeExit', this._beforeExitCallback);
      } else {
        process.removeListener('beforeExit', this._beforeExitCallback);
      }
    }

    get autoStart () {
      return this._autoStart
    }

    removeAll (eventNames) {
      if (!(this._listeners && this._listeners.length)) return
      for (const eventName of eventNames) {
        let l;
        while (l = this._listeners.find(l => l.eventName === eventName)) {
          this._listeners.splice(this._listeners.indexOf(l), 1);
        }
      }
    }

    set view (view) {
      if (view) {
        if (this._view) {
          this._view.detach();
        }
        this._view = view;
        this._view.attach(this);
      } else {
        if (this._view) {
          this._view.detach();
        }
        this._view = null;
      }
    }

    get view () {
      return this._view
    }

    beforeExit () {
      this.start();
    }

    test (name, testFn, options) {
      const test = new Test(name, testFn, options);
      this.tests.push(test);
      test.index = this.tests.length;
      return test
    }

    skip (name, testFn, options) {
      const test = this.test(name, testFn, options);
      test.skip = true;
      return test
    }

    only (name, testFn, options) {
      const test = this.test(name, testFn, options);
      test.only = true;
      this._only.push(test);
      return test
    }

    /**
     * Run all tests
     * @returns {Promise}
     */
    start () {
      if (this.state !== 0) return Promise.resolve()
      this.state = 1;
      if (this._only.length) {
        for (const test of this.tests) {
          if (this._only.indexOf(test) === -1) test.skip = true;
        }
      }
      const tests = this.tests;
      this.emit('start', tests.length);
      if (this.options.sequential) {
        return new Promise((resolve, reject) => {
          const run = () => {
            const test = tests.shift();
            if (test.skip) {
              this.emit('test-skip', test);
              if (tests.length) {
                run();
              } else {
                resolve();
              }
            } else {
              test.run()
                .then(result => {
                  try {
                    this.emitPass(test, result);
                    if (tests.length) {
                      run();
                    } else {
                      resolve();
                    }
                  } catch (err) {
                    reject(err);
                  }
                })
                .catch(err => {
                  try {
                    this.emitFail(test, err);
                    if (tests.length) {
                      run();
                    } else {
                      resolve();
                    }
                  } catch (err) {
                    reject(err);
                  }
                });
            }
          };
          run();
        })
      } else {
        return Promise
          .all(tests.map(test => {
            if (test.skip) {
              this.emit('test-skip', test);
            } else {
              this.emit('test-start', test);
              return test.run()
                .then(result => {
                  this.emitPass(test, result);
                  return result
                })
                .catch(err => {
                  this.emitFail(test, err);
                })
            }
          }))
          .then(results => {
            this.state = 2;
            this.emit('end');
            return results
          })
          .catch(err => {
            this.state = 2;
            this.emit('end');
            throw err
          })
      }
    }

    emitPass (test, result) {
      this.emit('test-pass', test, result);
      this.emit('test-end', test, result);
    }
    emitFail (test, err) {
      if (typeof process !== 'undefined') process.exitCode = 1;
      this.emit('test-fail', test, err);
      this.emit('test-end', test, err);
    }

    clear () {
      this.tests = [];
      this._only = [];
    }
  }

  return TestRunner;

})));