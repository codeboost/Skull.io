(function() {
  var EventEmitter, Model, ModelHelper, NSMgr, path, _,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  EventEmitter = require('events').EventEmitter;

  path = require('path');

  _ = require('underscore');

  exports.idAttribute = 'id';

  exports.Model = Model = (function(_super) {

    __extends(Model, _super);

    Model.prototype.autoUnlock = true;

    function Model() {
      this.locks = {};
      this.on('delete', function(data) {
        var id;
        console.log('removing lock due to delete');
        id = data[exports.idAttribute];
        return delete this.locks[id];
      });
      if (this.autoUnlock) {
        this.on('update', function(data, socket) {
          var cb, id, lock;
          id = data[exports.idAttribute];
          lock = this.locks[id];
          if (lock) {
            cb = function() {
              return console.log('Automatically unlocked ' + id);
            };
            return this.unlock(lock, cb);
          }
        });
      }
    }

    Model.prototype.create = function(data, callback, socket) {
      if (typeof callback === "function") callback(null, data);
      return this.emit('create', data, socket);
    };

    Model.prototype.update = function(data, callback, socket) {
      if (typeof callback === "function") callback(null, data);
      return this.emit('update', data, socket);
    };

    Model.prototype["delete"] = function(data, callback, socket) {
      if (typeof callback === "function") callback(null, data);
      return this.emit('delete', data, socket);
    };

    Model.prototype.lock = function(lockinfo, callback, socket) {
      var existing, id;
      if (!(lockinfo && lockinfo[exports.idAttribute])) {
        return typeof callback === "function" ? callback("error") : void 0;
      }
      id = lockinfo[exports.idAttribute];
      if (!id) {
        return typeof callback === "function" ? callback("error", lockinfo) : void 0;
      }
      existing = this.locks[id];
      if (!existing) {
        this.locks[id] = lockinfo;
        if (typeof callback === "function") callback(null, lockinfo);
        return this.emit('lock', lockinfo, socket);
      }
      if (existing.sid === lockinfo.sid) {
        return typeof callback === "function" ? callback(null, lockinfo) : void 0;
      }
      console.log('Refusing lock');
      return typeof callback === "function" ? callback("lock failed", lockinfo) : void 0;
    };

    Model.prototype.unlock = function(lockinfo, callback, socket) {
      var existing, id;
      if (!(lockinfo && lockinfo[exports.idAttribute])) {
        return typeof callback === "function" ? callback("error") : void 0;
      }
      id = lockinfo[exports.idAttribute];
      if (!id) {
        return typeof callback === "function" ? callback("error", lockinfo) : void 0;
      }
      existing = this.locks[id];
      if (!existing) {
        return typeof callback === "function" ? callback("error", lockinfo) : void 0;
      }
      if (lockinfo.sid !== existing.sid) {
        return typeof callback === "function" ? callback("error", lockinfo) : void 0;
      }
      delete this.locks[id];
      if (typeof callback === "function") callback(null, lockinfo);
      return this.emit('unlock', lockinfo, socket);
    };

    Model.prototype.unlockAll = function(socket) {
      var cb, lock, sid, sidLocks, _i, _len, _results;
      sid = socket.id;
      cb = function(err, lockinfo) {
        return console.log('Unlocked ', lockinfo[exports.idAttribute]);
      };
      sidLocks = _.select(this.locks, function(lock) {
        return lock.sid === sid;
      });
      _results = [];
      for (_i = 0, _len = sidLocks.length; _i < _len; _i++) {
        lock = sidLocks[_i];
        _results.push(this.unlock(lock, cb, socket));
      }
      return _results;
    };

    Model.prototype.broadcast = function(data, callback, socket) {
      return this.emit('broadcast', data, socket);
    };

    Model.prototype.matchFilter = function(filters, data) {
      var filter, key, val, _i, _len;
      if (!(filters && data)) return true;
      if (!_.isArray(filters)) filters = [filters];
      for (_i = 0, _len = filters.length; _i < _len; _i++) {
        filter = filters[_i];
        for (key in filter) {
          val = filter[key];
          if (data[key] !== val) return false;
        }
      }
      return true;
    };

    return Model;

  })(EventEmitter);

  ModelHelper = (function() {

    function ModelHelper(model, methods, socket, name) {
      var method, sid, _base, _i, _len, _ref,
        _this = this;
      this.model = model;
      this.methods = methods;
      this.socket = socket;
      this.name = name;
      this.handlers = {};
      sid = this.socket.id;
      if ((_base = this.model)._sockets == null) _base._sockets = {};
      if (!this.model._sockets[sid]) this.model._sockets[sid] = this.socket;
      _ref = this.methods;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        this.handlers[method] = this.createHandler(method);
        this.model.on(method, this.handlers[method]);
      }
      this.socket.on('disconnect', function() {
        var method, _j, _len2, _ref2;
        _ref2 = _this.methods;
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          method = _ref2[_j];
          _this.model.removeListener(method, _this.handlers[method]);
        }
        return true;
      });
    }

    ModelHelper.prototype.createHandler = function(method) {
      var model, name;
      model = this.model;
      name = this.name;
      return function(data, socket) {
        var sid, skt, socketId, _ref;
        socketId = socket != null ? socket.id : void 0;
        _ref = model._sockets;
        for (sid in _ref) {
          skt = _ref[sid];
          if (sid !== socketId) skt.emit(method, name, data);
        }
        return true;
      };
    };

    return ModelHelper;

  })();

  exports.SidModel = (function(_super) {

    __extends(SidModel, _super);

    SidModel.prototype.methods = ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast'];

    function SidModel() {
      var method, _i, _len, _ref;
      this.usrModels = {};
      _ref = this.methods;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        this[method] = this.fwdMethod(method);
      }
      this.read = this.fwdMethod('read');
      this.clientCommand = this.fwdMethod('clientCommand');
    }

    SidModel.prototype.addModel = function(socket, model) {
      var _this = this;
      this.usrModels[socket.id] = new ModelHelper(model, this.methods, socket, this.name);
      socket.on('disconnect', function() {
        return delete model._sockets[socket.id];
      });
      return model;
    };

    SidModel.prototype.fwdMethod = function(method) {
      var _this = this;
      return function(data, callback, socket) {
        var modelHelper, _base;
        modelHelper = _this.usrModels[socket.id];
        return modelHelper != null ? typeof (_base = modelHelper.model)[method] === "function" ? _base[method](data, callback, socket) : void 0 : void 0;
      };
    };

    return SidModel;

  })(Model);

  NSMgr = (function(_super) {

    __extends(NSMgr, _super);

    function NSMgr(ns) {
      var _this = this;
      this.ns = ns;
      this.models = {};
      this.methods = ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast'];
      this.ns.on('connection', function(socket) {
        var methodName, _i, _len, _ref;
        _ref = _this.methods;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          methodName = _ref[_i];
          _this.addSocketHandler(socket, methodName);
        }
        _this.addSocketHandler(socket, 'read');
        _this.addSocketHandler(socket, 'clientCommand');
        socket.filter = {};
        socket.on('disconnect', function() {
          var key, mdl, _ref2;
          _ref2 = _this.models;
          for (key in _ref2) {
            mdl = _ref2[key];
            mdl.unlockAll(socket);
          }
          console.log('Socket ' + socket.id + ' disconnected');
          return _this.emit('disconnect', socket);
        });
        return _this.emit('connection', socket);
      });
    }

    NSMgr.prototype.addModel = function(name, model) {
      var methodName, _i, _len, _ref;
      if (!model) {
        model = name;
        name = model != null ? model.name : void 0;
      }
      if (!(model && name)) return false;
      if (!_.isString(name)) return false;
      if (model.name == null) model.name = name;
      this.models[name] = model;
      _ref = this.methods;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        methodName = _ref[_i];
        this.addModelHandler(model, name, methodName);
      }
      console.log('Model %s added', name);
      return model;
    };

    NSMgr.prototype.addModelHandler = function(model, modelName, eventName) {
      var _this = this;
      if (!(model instanceof EventEmitter)) return;
      return model.on(eventName, function(data, socket) {
        var filter, key, skt, srcId, _ref, _ref2, _results;
        console.log('Emitting event %s on model %s', eventName, modelName);
        srcId = socket != null ? socket.id : void 0;
        _ref = _this.ns.sockets;
        _results = [];
        for (key in _ref) {
          skt = _ref[key];
          if (skt.id !== srcId) {
            filter = (_ref2 = skt.filter) != null ? _ref2[modelName] : void 0;
            if (model.matchFilter(filter, data)) {
              _results.push(skt.emit(eventName, modelName, data));
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
    };

    NSMgr.prototype.addSocketHandler = function(socket, eventName) {
      var _this = this;
      return socket.on(eventName, function(modelName, data, callback) {
        var model;
        if (eventName === 'read') socket.filter[modelName] = data;
        console.log('Event %s for model %s from client %s, data: %j', eventName, modelName, socket.id, data);
        model = _this.models[modelName];
        if (model != null) {
          if (typeof model[eventName] === "function") {
            model[eventName](data, callback, socket);
          }
        }
        return _this.emit(eventName, modelName, data, callback, socket);
      });
    };

    return NSMgr;

  })(EventEmitter);

  exports.Server = (function() {

    function Server(io) {
      var dir, _ref, _ref2;
      this.io = io;
      dir = path.dirname(module.filename);
      if ((_ref = this.io.server) != null) {
        if ((_ref2 = _ref.routes) != null) {
          _ref2.app.get('/skull.io/skull.io.js', function(req, res) {
            return res.sendfile(path.join(dir, 'skull-client.js'));
          });
        }
      }
    }

    Server.prototype.of = function(namespace) {
      var ns;
      ns = this.io.of(namespace);
      return new NSMgr(ns);
    };

    return Server;

  })();

}).call(this);
