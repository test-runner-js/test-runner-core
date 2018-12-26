'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Tom = _interopDefault(require('test-object-model'));
var a = _interopDefault(require('assert'));

var consoleView = ViewBase => class ConsoleView extends ViewBase {
  start (count) {
    this.log(`Starting: ${count} tests`);
  }
  testPass (test, result) {
    this.log('✓', test.name, result || 'ok');
  }
  testSkip (test) {
    this.log('-', test.name);
  }
  testFail (test, err) {
    this.log('⨯', test.name);
  }
  end () {
    this.log(`End`);
  }
};

/**
 * @module obso
 */

/**
 * @alias module:obso
 */
class Emitter {
  /**
   * Emit an event.
   * @param {string} [eventName] - the event name to emit, omitting the name will catch all events.
   * @param ...args {*} - args to pass to the event handler
   */
  emit (eventName, ...args) {
    if (this._listeners && this._listeners.length > 0) {
      const toRemove = [];

      /* invoke each relevant listener */
      for (const listener of this._listeners) {
        const handlerArgs = args.slice();
        if (listener.eventName === '__ALL__') {
          handlerArgs.unshift(eventName);
        }

        if (listener.eventName === '__ALL__' || listener.eventName === eventName) {
          listener.handler.call(this, ...handlerArgs);

          /* remove once handler */
          if (listener.once) toRemove.push(listener);
        }
      }

      toRemove.forEach(listener => {
        this._listeners.splice(this._listeners.indexOf(listener), 1);
      });
    }

    /* bubble event up */
    if (this.parent) this.parent.emitTarget(eventName, this, ...args);
  }

  emitTarget (eventName, target, ...args) {
    if (this._listeners && this._listeners.length > 0) {
      const toRemove = [];

      /* invoke each relevant listener */
      for (const listener of this._listeners) {
        const handlerArgs = args.slice();
        if (listener.eventName === '__ALL__') {
          handlerArgs.unshift(eventName);
        }

        if (listener.eventName === '__ALL__' || listener.eventName === eventName) {
          listener.handler.call(target, ...handlerArgs);

          /* remove once handler */
          if (listener.once) toRemove.push(listener);
        }
      }

      toRemove.forEach(listener => {
        this._listeners.splice(this._listeners.indexOf(listener), 1);
      });
    }

    /* bubble event up */
    if (this.parent) this.parent.emitTarget(eventName, target || this, ...args);
  }

   /**
    * Register an event listener.
    * @param {string} eventName - the event name to watch
    * @param {function} handler - the event handler
    * @param {object} [options]
    * @param {boolean} [options.once]
    */
  on (eventName, handler, options) {
    createListenersArray(this);
    options = options || {};
    if (arguments.length === 1 && typeof eventName === 'function') {
      handler = eventName;
      eventName = '__ALL__';
    }
    this._listeners.push({ eventName, handler: handler, once: options.once });
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

  /**
   * Once.
   * @param {string} eventName - the event name to watch
   * @param {function} handler - the event handler
   */
  once (eventName, handler) {
    /* TODO: the once option is browser-only */
    this.on(eventName, handler, { once: true });
  }

  /**
   * Propagate.
   * @param {string} eventName - the event name to propagate
   * @param {object} from - the emitter to propagate from
   */
  propagate (eventName, from) {
    from.on(eventName, (...args) => this.emit(eventName, ...args));
  }
}

/**
 * Alias for `on`.
 */
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
 * Takes any input and guarantees an array back.
 *
 * - converts array-like objects (e.g. `arguments`) to a real array
 * - converts `undefined` to an empty array
 * - converts any another other, singular value (including `null`) into an array containing that value
 * - ignores input which is already an array
 *
 * @module array-back
 * @example
 * > const arrayify = require('array-back')
 *
 * > arrayify(undefined)
 * []
 *
 * > arrayify(null)
 * [ null ]
 *
 * > arrayify(0)
 * [ 0 ]
 *
 * > arrayify([ 1, 2 ])
 * [ 1, 2 ]
 *
 * > function f(){ return arrayify(arguments); }
 * > f(1,2,3)
 * [ 1, 2, 3 ]
 */

function isObject (input) {
  return typeof input === 'object' && input !== null
}

function isArrayLike (input) {
  return isObject(input) && typeof input.length === 'number'
}

/**
 * @param {*} - the input value to convert to an array
 * @returns {Array}
 * @alias module:array-back
 */
function arrayify (input) {
  if (Array.isArray(input)) {
    return input
  } else {
    if (input === undefined) {
      return []
    } else if (isArrayLike(input)) {
      return Array.prototype.slice.call(input)
    } else {
      return [ input ]
    }
  }
}

/**
 * @module fsm-base
 * @typicalname stateMachine
 */

const _state = new WeakMap();

/**
 * @class
 * @alias module:fsm-base
 * @extends {Emitter}
 */
class StateMachine extends Emitter {
  constructor (validMoves) {
    super();
    this._validMoves = arrayify(validMoves).map(move => {
      if (!Array.isArray(move.from)) move.from = [ move.from ];
      if (!Array.isArray(move.to)) move.to = [ move.to ];
      return move
    });
  }

  /**
   * The current state
   * @type {string} state
   * @throws `INVALID_MOVE` if an invalid move made
   */
  get state () {
    return _state.get(this)
  }

  set state (state) {
    this.setState(state);
  }

  /**
   * Set the current state. The second arg onward will be sent as event args.
   * @param {string} state
   */
  setState (state, ...args) {
    /* nothing to do */
    if (this.state === state) return

    const validTo = this._validMoves.some(move => move.to.indexOf(state) > -1);
    if (!validTo) {
      const msg = `Invalid state: ${state}`;
      const err = new Error(msg);
      err.name = 'INVALID_MOVE';
      throw err
    }

    let moved = false;
    const prevState = this.state;
    this._validMoves.forEach(move => {
      if (move.from.indexOf(this.state) > -1 && move.to.indexOf(state) > -1) {
        _state.set(this, state);
        moved = true;
        /**
         * fired on every state change
         * @event module:fsm-base#state
         * @param state {string} - the new state
         * @param prev {string} - the previous state
         */
        this.emit('state', state, prevState);

        /**
         * fired on every state change
         * @event module:fsm-base#&lt;state value&gt;
         */
        this.emit(state, ...args);
      }
    });
    if (!moved) {
      let froms = this._validMoves
        .filter(move => move.to.indexOf(state) > -1)
        .map(move => move.from.map(from => `'${from}'`))
        .reduce(flatten);
      const msg = `Can only move to '${state}' from ${froms.join(' or ') || '<unspecified>'} (not '${prevState}')`;
      const err = new Error(msg);
      err.name = 'INVALID_MOVE';
      throw err
    }
  }
}

function flatten (prev, curr) {
  return prev.concat(curr)
}

class ViewBase {
  attach (runner) {
    if (this.attachedTo !== runner) {
      this._callback = {
        start: this.start.bind(this),
        end: this.end.bind(this),
        testPass: this.testPass.bind(this),
        testFail: this.testFail.bind(this),
        testSkip: this.testSkip.bind(this)
      };
      runner.on('start', this._callback.start);
      runner.on('end', this._callback.end);
      runner.tom.on('pass', this._callback.testPass);
      runner.tom.on('fail', this._callback.testFail);
      runner.tom.on('skip', this._callback.testSkip);
      this.attachedTo = runner;
    }
  }

  detach () {
    if (this.attachedTo && this._callback) {
      this.attachedTo.removeEventListener('start', this._callback.start);
      this.attachedTo.removeEventListener('end', this._callback.end);
      this.attachedTo.tom.removeEventListener('pass', this._callback.testPass);
      this.attachedTo.tom.removeEventListener('fail', this._callback.testFail);
      this.attachedTo.tom.removeEventListener('skip', this._callback.testSkip);
      this.attachedTo = null;
    }
  }

  log () {
    console.log(...arguments);
  }
  start (count) {
    throw new Error('not implemented')
  }
  end () {
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

/**
 * @alias module:test-runner
 @ @param {object} [options]
 @ @param {function} [options.view]
 @ @param {object} [options.tom]
 * @emits start
 * @emits end
 */
class TestRunner extends StateMachine {
  constructor (options) {
    options = options || {};
    super([
      { from: undefined, to: 'pending' },
      { from: 'pending', to: 'start' },
      { from: 'start', to: 'end' },
    ]);
    this.state = 'pending';
    this.tom = options.tom;
    const ViewClass = (options.view || consoleView)(ViewBase);
    this.view = new ViewClass();
  }

  set view (view) {
    if (view) {
      if (this._view) this._view.detach();
      this._view = view;
      this._view.attach(this);
    } else {
      if (this._view) this._view.detach();
      this._view = null;
    }
  }

  get view () {
    return this._view
  }

  start () {
    const count = Array.from(this.tom).length;
    this.setState('start', count);
    return this.runInParallel(this.tom).then(results => {
      this.state = 'end';
      return results
    })
  }

  runInParallel (tom) {
    return Promise.all(Array.from(tom).map(test => {
      return test.run()
        .catch(err => {
          // keep going when tests fail but crash for programmer error
        })
    }))
  }
}

function halt (err) {
  console.log(err);
  process.exitCode = 1;
}

{ /* runner.start(): pass */
  let counts = [];
  const tom = new Tom('tom');
  tom.test('one', () => counts.push('one'));
  tom.test('two', () => counts.push('two'));

  const runner = new TestRunner({ tom });
  runner.start()
    .then(() => {
      a.deepStrictEqual(counts, [ 'one', 'two' ]);
      a.strictEqual(tom.children[0].state, 'pass');
      a.strictEqual(tom.children[1].state, 'pass');
    })
    .catch(halt);
}

{ /* runner.start(): fail */
  let counts = [];
  const tom = new Tom('tom');
  tom.test('one', () => {
    counts.push('one');
    throw new Error('broken')
  });
  tom.test('two', () => counts.push('two'));

  const runner = new TestRunner({ tom });
  runner.start()
    .then(() => {
      a.deepStrictEqual(counts, [ 'one', 'two' ]);
      a.strictEqual(tom.children[0].state, 'fail');
      a.strictEqual(tom.children[1].state, 'pass');
    })
    .catch(halt);
}

{ /* runner.start(): pass, events */
  let counts = [];
  const tom = new Tom('tom');
  tom.test(new Tom('one', () => true));

  const runner = new TestRunner({ tom });
  a.strictEqual(runner.state, 'pending');
  runner.on('start', () => counts.push('start'));
  runner.start()
    .then(() => {
      a.strictEqual(runner.state, 'end');
      counts.push('end');
      a.deepStrictEqual(counts, [ 'start', 'end' ]);
    })
    .catch(halt);
}

{ /* runner.start(): test events */
  let counts = [];
  const tom = new Tom('tom');
  tom.test('one', () => true);
  tom.test('two', () => { throw new Error('fail') });
  tom.skip('three', () => true);

  const runner = new TestRunner({ tom });
  runner.tom.on('pass', () => counts.push('pass'));
  runner.tom.on('fail', () => counts.push('fail'));
  runner.tom.on('skip', () => counts.push('skip'));
  runner.start()
    .then(() => {
      a.deepStrictEqual(counts, [ 'skip', 'pass', 'fail', 'skip' ]);
    })
    .catch(halt);
}

function halt$1 (err) {
  console.log(err);
  process.exitCode = 1;
}

{ /* custom view */
  let counts = [];
  const root = new Tom('root');
  root.add(new Tom('one', () => counts.push('one')));
  root.add(new Tom('two', () => counts.push('two')));

  const view = ViewBase => class extends ViewBase {
    start () {
      counts.push('start');
    }
    end () {
      counts.push('end');
    }
    testPass (test, result) {
    }
    testFail (test, err) {
    }
    testSkip (test) {
    }
  };

  const runner = new TestRunner({ view, tom: root });
  runner.start()
    .then(root => a.deepStrictEqual(counts, [ 'start', 'one', 'two', 'end' ]))
    .catch(halt$1);
}