(function() {
  var EventEmitter, LockableModel, Model, View, g_Debug, g_Io, io, log, path, util, _;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  EventEmitter = require('events').EventEmitter;
  _ = require('underscore');
  io = require('socket.io');
  util = require('util');
  path = require('path');
  g_Debug = true;
  g_Io = null;
  exports.enableLogging = function(yesorno) {
    return g_Debug = yesorno;
  };
  log = function() {
    if (g_Debug) {
      return console.log.apply(console, arguments);
    }
  };
  exports.listen = function(io) {
    var dir, _ref, _ref2;
    g_Io = io;
    dir = path.dirname(module.filename);
    return (_ref = io.server) != null ? (_ref2 = _ref.routes) != null ? _ref2.app.get('/skull.io/skull.io.js', function(req, res) {
      return res.sendfile(path.join(dir, 'clientSkull.js'));
    }) : void 0 : void 0;
  };
  LockableModel = (function() {
    __extends(LockableModel, EventEmitter);
    function LockableModel() {
      log('Lockable constructor');
      this._locks = {};
      this.setMaxListeners(0);
      LockableModel.__super__.constructor.apply(this, arguments);
    }
    LockableModel.prototype.lock = function(lockinfo, callback) {
      var curlock;
      curlock = this._locks[lockinfo.id];
      log('Lock request from ' + lockinfo.__sid);
      if (curlock && curlock.__sid !== lockinfo.__sid) {
        return typeof callback === "function" ? callback("failed", lockinfo) : void 0;
      }
      this._locks[lockinfo.id] = lockinfo;
      if (typeof callback === "function") {
        callback(callback(null, lockinfo));
      }
      this.emit("lock", lockinfo);
      return true;
    };
    LockableModel.prototype.unlock = function(lockinfo, callback) {
      var curlock;
      curlock = this._locks[lockinfo.id];
      if (curlock) {
        log('Unlock ' + lockinfo.id + ' by ' + lockinfo.__sid);
        delete this._locks[lockinfo.id];
        if (callback) {
          if (typeof callback === "function") {
            callback(callback(null, lockinfo));
          }
        }
        this.emit("unlock", lockinfo);
        return true;
      }
      return typeof callback === "function" ? callback("failed", lockinfo) : void 0;
    };
    LockableModel.prototype.removeUserLocks = function(sid) {
      log("Removing " + sid + " from these: " + (util.inspect(this._locks)));
      return _.each(this._locks, __bind(function(lock) {
        if (lock.__sid === sid) {
          return this.unlock(lock);
        }
      }, this));
    };
    return LockableModel;
  })();
  Model = (function() {
    __extends(Model, LockableModel);
    function Model() {
      Model.__super__.constructor.apply(this, arguments);
    }
    Model.prototype.read = function(filter, callback) {
      return callback(null, {});
    };
    Model.prototype.create = function(data, callback) {
      return cabllack(null, data);
    };
    Model.prototype.update = function(data, callback) {
      return callback(null, data);
    };
    Model.prototype["delete"] = function(data, callback) {
      return callback(null, data);
    };
    return Model;
  })();
  View = (function() {
    function View(name, model) {
      this.name = name;
      this.model = model;
      this.connection = __bind(this.connection, this);
      log('Skull View: Creating view ' + this.name);
      this.widget = g_Io.of(this.name);
      this.widget.on('connection', this.connection);
    }
    View.prototype.unbind = function() {
      log('Unbinding view ' + this.name);
      return this.widget.removeListener('connection', this.connection);
    };
    View.prototype.connection = function(socket) {
      var model, _ref;
      log('New connection to ' + this.name + ' from socket ' + socket.id);
      model = (_ref = typeof this.model === "function" ? this.model(socket, this.name) : void 0) != null ? _ref : this.model;
      if (!model) {
        log('Model lookup failed. Bailing out.');
        socket.emit('error', 'Cannot access dynamic model ' + this.name + '. Model lookup failed');
        return;
      }
      return this.authorize(socket, __bind(function() {
        socket.on('disconnect', __bind(function() {
          log('socket disconnected: ' + socket.id);
          return model.removeUserLocks(socket.id);
        }, this));
        socket.on('read', __bind(function(data, callback) {
          return typeof model.read === "function" ? model.read(data, __bind(function(result, data) {
            return typeof callback === "function" ? callback(result, data, model._locks) : void 0;
          }, this)) : void 0;
        }, this));
        this.fuseEvents(socket, model, ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']);
        socket.on('command', function(name, data, callback) {
          var cb;
          if (callback == null) {
            callback = function() {};
          }
          log('Client command: ' + name);
          cb = model['client_' + name];
          if (!cb) {
            return typeof callback === "function" ? callback("command not supported") : void 0;
          }
          return cb(data, callback, socket);
        });
        return model.on('error', function(message, data) {
          return socket.emit('error', message, data);
        });
      }, this), function(errorMsg) {
        return socket.emit('error', errorMsg);
      });
    };
    View.prototype.fuseEvents = function(socket, model, loEvents) {
      log('Fusing events for model ' + model.name + ' to socket ' + socket.id);
      model.setMaxListeners(0);
      socket.setMaxListeners(0);
      return _.each(loEvents, function(ev) {
        var moHandler;
        if (!model[ev]) {
          return;
        }
        moHandler = function(data) {
          log('From Model -> to Socket: ' + socket.id + ' : ' + ev + ': ' + util.inspect(arguments[0]));
          return socket.emit.call(socket, ev, data);
        };
        model.on(ev, moHandler);
        socket.on('disconnect', function() {
          log('** Model ' + model.name + ' !--!  ' + socket.id);
          return model.removeListener(ev, moHandler);
        });
        return socket.on(ev, function() {
          var callback, data, extra, _ref;
          log('From Socket ' + socket.id + ' to model : ' + model.name + ' : ' + ev + ': ' + util.inspect(arguments[0]));
          data = arguments[0], callback = arguments[1];
          if (callback == null) {
            callback = function() {};
          }
          extra = {
            socket: socket
          };
          if (typeof data === 'object') {
            data.__sid = socket.id;
          }
          return (_ref = model[ev]) != null ? _ref.call(model, data, callback, extra) : void 0;
        });
      });
    };
    View.prototype.authorize = function(socket, success, error) {
      return success();
    };
    return View;
  })();
  exports.Model = Model;
  exports.View = View;
}).call(this);
