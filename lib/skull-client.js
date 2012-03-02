(function() {
  var CollectionHelper, ModelHelper, Skull, SkullClient, serverLockModel, serverUnlockModel,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Skull = window.Skull = {};

  Skull.isValidModel = function(model) {
    return (typeof model === 'object') && (model instanceof Skull.Model || model instanceof Skull.Collection);
  };

  serverLockModel = function(model, lockinfo, silent) {
    var lockedByMe;
    if (!(lockinfo && model)) return;
    lockedByMe = lockinfo.sid === model.sid();
    model.isLockedByMe = lockedByMe;
    model.isLocked = true;
    model.lockinfo = lockinfo;
    return model.trigger('locked', lockedByMe, lockinfo);
  };

  serverUnlockModel = function(model, lockinfo) {
    if (!model) return;
    model.isLocked = false;
    model.isLockedByMe = false;
    delete model.lockinfo;
    return model.trigger('unlocked');
  };

  ModelHelper = (function() {

    function ModelHelper(model, name) {
      this.model = model;
      this.name = name;
      if (!this.model instanceof Skull.Model) throw 'Skull.Model expected';
    }

    ModelHelper.prototype.create = function(data) {
      var _ref;
      return (_ref = this.model.collection) != null ? _ref.create(data) : void 0;
    };

    ModelHelper.prototype.update = function(data) {
      return this.model.set(data);
    };

    ModelHelper.prototype["delete"] = function() {
      return this.model.destroy();
    };

    ModelHelper.prototype.lock = function(lockinfo) {
      return serverLockModel(this.model, lockinfo);
    };

    ModelHelper.prototype.unlock = function(lockinfo) {
      return serverUnlockModel(this.model, lockinfo);
    };

    ModelHelper.prototype.broadcast = function(data) {
      return this.model.trigger('server-broadcast', data);
    };

    return ModelHelper;

  })();

  CollectionHelper = (function() {

    function CollectionHelper(collection, name) {
      this.collection = collection;
      this.name = name;
      if (!this.collection instanceof Skull.Collection) {
        throw 'Skull.Collection expected';
      }
    }

    CollectionHelper.prototype.create = function(data) {
      var id, model;
      id = data[Backbone.Model.prototype.idAttribute];
      if (id) {
        model = this.collection.get(id);
        if (model) {
          model.set(data);
          return;
        }
      }
      return this.collection.add(data);
    };

    CollectionHelper.prototype.update = function(data) {
      var id, model;
      id = data[Backbone.Model.prototype.idAttribute];
      if (id) model = this.collection.get(id);
      return model != null ? model.set(data) : void 0;
    };

    CollectionHelper.prototype["delete"] = function(data) {
      var id, model;
      id = data[Backbone.Model.prototype.idAttribute];
      if (id) model = this.collection.get(id);
      if (model) return this.collection.remove(model);
    };

    CollectionHelper.prototype.lock = function(lockinfo) {
      var id, model;
      id = lockinfo[Backbone.Model.prototype.idAttribute];
      if (id) model = this.collection.get(id);
      if (model) return serverLockModel(model, lockinfo);
    };

    CollectionHelper.prototype.unlock = function(lockinfo) {
      var id, model;
      id = lockinfo[Backbone.Model.prototype.idAttribute];
      if (id) model = this.collection.get(id);
      if (model) return serverUnlockModel(model, lockinfo);
    };

    CollectionHelper.prototype.broadcast = function(data) {
      return this.collection.trigger('server-broadcast', data);
    };

    return CollectionHelper;

  })();

  SkullClient = (function() {

    function SkullClient(socket, clientName) {
      var eventName, _i, _len, _ref;
      this.socket = socket;
      this.clientName = clientName;
      this.sync = __bind(this.sync, this);
      this.models = {};
      this.sid = this.socket.socket.sessionid;
      _ref = ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        eventName = _ref[_i];
        this.addHandler(eventName);
      }
    }

    SkullClient.prototype.addHandler = function(eventName) {
      var _this = this;
      return this.socket.on(eventName, function(modelName, data) {
        var model;
        console.log('Skull: Socket %s, %s', eventName, modelName);
        model = _this.models[modelName];
        return model != null ? typeof model[eventName] === "function" ? model[eventName](data) : void 0 : void 0;
      });
    };

    SkullClient.prototype.addModel = function(model, name) {
      var Helper;
      if (!Skull.isValidModel(model)) {
        throw 'Skull.Model or Skull.Collection expected!';
      }
      if (model instanceof Skull.Collection) {
        Helper = CollectionHelper;
      } else {
        Helper = ModelHelper;
      }
      if (name == null) name = model.name();
      model._skull = this;
      model.sync = this.sync;
      this.models[name] = new Helper(model, name);
      return model;
    };

    SkullClient.prototype.sync = function(method, model, cbo) {
      var methodData, name, _base, _ref;
      name = (_ref = typeof model.name === "function" ? model.name() : void 0) != null ? _ref : typeof (_base = model.collection).name === "function" ? _base.name() : void 0;
      console.log('[Skull] %s: emit %s, %s', this.clientName, method, name);
      methodData = method === 'read' ? cbo.filter : void 0;
      if (methodData == null) methodData = model.toJSON();
      return this.socket.emit(method, name, methodData, function(err, data) {
        if (err === null) {
          return cbo.success(data);
        } else {
          return cbo.error(model);
        }
      });
    };

    return SkullClient;

  })();

  Skull.createClient = function(socket) {
    if (Skull.clients == null) Skull.clients = {};
    return Skull.clients[socket.name] = new SkullClient(socket, socket.name);
  };

  Skull.BackboneSync = Backbone.sync;

  Backbone.sync = function(method, model, cbo) {
    var sync, _ref, _ref2, _ref3;
    sync = (_ref = (_ref2 = model.sync) != null ? _ref2 : (_ref3 = model.collection) != null ? _ref3.sync : void 0) != null ? _ref : Skull.BackboneSync;
    return typeof sync === "function" ? sync(method, model, cbo) : void 0;
  };

  Skull.Model = (function(_super) {

    __extends(Model, _super);

    function Model() {
      Model.__super__.constructor.apply(this, arguments);
    }

    Model.prototype.isLocked = false;

    Model.prototype.isLockedByMe = false;

    Model.prototype.name = function() {
      var _ref, _ref2, _ref3;
      return (_ref = (_ref2 = this.collection) != null ? _ref2.url : void 0) != null ? _ref : (_ref3 = typeof this.url === "function" ? this.url() : void 0) != null ? _ref3 : this.url;
    };

    Model.prototype.setLockInfo = function(lockinfo) {
      return serverLockModel(this, lockinfo);
    };

    Model.prototype.sid = function() {
      var _ref, _ref2;
      return (_ref = (_ref2 = this._skull) != null ? _ref2.sid : void 0) != null ? _ref : this.collection.sid();
    };

    Model.prototype.addEmbedded = function(model, name) {
      var _ref;
      return ((_ref = this._skull) != null ? _ref : this.collection._skull).addModel(model, name);
    };

    Model.prototype.skullEmit = function() {
      var emitter, _ref, _ref2, _ref3;
      emitter = (_ref = (_ref2 = this._skull) != null ? _ref2.socket : void 0) != null ? _ref : (_ref3 = this.collection._skull) != null ? _ref3.socket : void 0;
      return emitter != null ? emitter.emit.apply(emitter, arguments) : void 0;
    };

    Model.prototype.tryLock = function(action, callback) {
      var cb, lockinfo,
        _this = this;
      if (typeof action === 'function') callback = action;
      cb = function(err, lockinfo) {
        if (err === null) {
          serverLockModel(_this, lockinfo);
        } else {
          _this.trigger('lock-failed', lockinfo);
        }
        return typeof callback === "function" ? callback(err, lockinfo) : void 0;
      };
      lockinfo = {};
      lockinfo[Backbone.Model.prototype.idAttribute] = this.id;
      lockinfo['sid'] = this.sid();
      lockinfo['action'] = action;
      if (this.isLocked && !this.isLockedByMe) return cb('failed', this.lockinfo);
      if (this.isLockedByMe) return cb(null, this.lockinfo);
      return this.skullEmit('lock', this.name(), lockinfo, cb);
    };

    Model.prototype.unlock = function(callback) {
      var cb, lockinfo,
        _this = this;
      lockinfo = {};
      lockinfo[Backbone.Model.prototype.idAttribute] = this.id;
      lockinfo['sid'] = this.sid();
      if (this.isLocked && !this.isLockedByMe) {
        return typeof callback === "function" ? callback('failed', lockinfo) : void 0;
      }
      cb = function(err, lockinfo) {
        serverUnlockModel(_this, lockinfo);
        return typeof callback === "function" ? callback(err, lockinfo) : void 0;
      };
      return this.skullEmit('unlock', this.name(), lockinfo, cb);
    };

    Model.prototype.broadcast = function(data, callback) {
      if (callback == null) callback = function() {};
      return this.skullEmit('broadcast', this.name(), data, callback);
    };

    Model.prototype.emitCommand = function(cmd, data, callback) {
      if (callback == null) callback = function() {};
      if (data == null) data = {};
      data._command = cmd;
      return this.skullEmit('clientCommand', this.name(), data, callback);
    };

    return Model;

  })(Backbone.Model);

  Skull.Collection = (function(_super) {

    __extends(Collection, _super);

    function Collection() {
      Collection.__super__.constructor.apply(this, arguments);
    }

    Collection.prototype.model = Skull.Model;

    Collection.prototype.name = function() {
      return this.url;
    };

    Collection.prototype.sid = function() {
      return this._skull.sid;
    };

    Collection.prototype.addEmbedded = function(model, name) {
      return this._skull.addModel(model, name);
    };

    Collection.prototype.setLockInfo = function(lockinfo) {
      var lock, mdl, _i, _len, _results;
      if (!lockinfo) return;
      if (!_.isArray(lockinfo)) lockinfo = [lockinfo];
      _results = [];
      for (_i = 0, _len = lockinfo.length; _i < _len; _i++) {
        lock = lockinfo[_i];
        mdl = this.get(lock[Backbone.Model.idAttribute]);
        if (mdl) {
          _results.push(serverLockModel(mdl, lock));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Collection.prototype.broadcast = function(data, callback) {
      if (callback == null) callback = function() {};
      return this._skull.socket.emit('broadcast', this.name(), data, callback);
    };

    Collection.prototype.emitCommand = function(cmd, data, callback) {
      if (callback == null) callback = function() {};
      if (data == null) data = {};
      data._command = cmd;
      return this._skull.socket.emit('clientCommand', this.name, data, callback);
    };

    return Collection;

  })(Backbone.Collection);

}).call(this);
