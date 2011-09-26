(function() {
  var BackboneSync, Collection, Config, LockableModel, Model, log, _ref;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  if (typeof window !== "undefined" && window !== null) {
    if ((_ref = window.module) != null) {
      _ref.enter('skull');
    }
  }
  Backbone.assert = function(what) {
    if (!what) {
      console.log("Assertion failed!");
      debugger;
    }
  };
  Config = {};
  Config.debug = true;
  exports.Config = Config;
  log = function(msg) {
    if (Config.debug) {
      return console.log(msg);
    }
  };
  LockableModel = (function() {
    __extends(LockableModel, Backbone.Model);
    function LockableModel() {
      this.locked = false;
      this.lockedBy = {};
      this.editing = false;
      LockableModel.__super__.constructor.apply(this, arguments);
    }
    LockableModel.prototype.initShared = function() {
      return this.bind('remove', __bind(function() {
        if (this.view) {
          return this.view.remove();
        }
      }, this));
    };
    LockableModel.prototype.isLocked = function() {
      return this.locked;
    };
    LockableModel.prototype.isEditing = function() {
      return this.editing;
    };
    LockableModel.prototype.setLockInfo = function(lockinfo) {
      log('set lock info');
      if (this.id && lockinfo[this.id]) {
        if (lockinfo[this.id].__sid === this.__sid) {
          log('Model locked by me');
          this.locked = false;
          this.lockedBy = this.__sid;
          this.editing = true;
          return this.trigger('locked', this, this.lockedBy);
        } else {
          log('Model locked by ' + lockinfo[this.id].__sid);
          this.editing = false;
          return this.serverLock(lockinfo[this.id].__sid);
        }
      } else {
        return log('ignoring lock info - no @id or lockinfo[@id]');
      }
    };
    LockableModel.prototype.serverLock = function(who) {
      if (this.editing && who === this.__sid) {
        this.lockedBy = this.__sid;
        return this.trigger('locked', this, this.lockedBy);
      }
      this.locked = true;
      this.lockedBy = who;
      return this.trigger('locked', this, this.lockedBy);
    };
    LockableModel.prototype.serverUnlock = function() {
      this.locked = false;
      this.lockedBy = "";
      return this.trigger('unlocked', this, this.lockedBy);
    };
    LockableModel.prototype.lock = function(callback) {
      if (this.editing) {
        return callback(null, this.lockedBy);
      }
      if (this.locked) {
        return callback('error', this.lockedBy);
      }
      Backbone.assert(this.locked === false && this.editing === false);
      return this.trigger('lock', this, __bind(function(err, lockinfo) {
        console.log('Lock result = ' + err);
        if (err === null) {
          this.editing = true;
        }
        return callback(err, lockinfo);
      }, this));
    };
    LockableModel.prototype.unlock = function(callback) {
      if (this.editing) {
        this.editing = false;
        return this.trigger('unlock', this, callback);
      }
    };
    return LockableModel;
  })();
  Model = (function() {
    __extends(Model, LockableModel);
    function Model(options) {
      var url;
      url = (options != null ? options.url : void 0) || this.url;
      if (options) {
        delete options.url;
      }
      if (url && typeof url === 'string') {
        this.socket = io.connect(url);
        this.socket.on('disconnect', __bind(function() {
          return this.trigger('disconnected');
        }, this));
        this.socket.on('connect', __bind(function() {
          this.__sid = this.socket.socket.sessionid;
          return log('connected --> ' + this.__sid);
        }, this));
        this.socket.on('update', __bind(function(data) {
          return this.set(data);
        }, this));
        this.socket.on('delete', __bind(function() {
          return this.destroy();
        }, this));
        this.socket.on('lock', __bind(function(lockinfo) {
          return this.serverLock(lockinfo.__sid);
        }, this));
        this.socket.on('unlock', __bind(function(lockinfo) {
          return this.serverUnlock(lockinfo.__sid);
        }, this));
        this.socket.on('rejected', __bind(function(modinfo) {
          this.unset('moderating');
          return this.trigger('rejected', modinfo);
        }, this));
        this.bind('lock', __bind(function(model, callback) {
          log('model lock ' + this.id);
          if (this.id) {
            return this.socket.emit('lock', {
              id: this.id
            }, function(err, lockinfo) {
              log('Called back: ' + err);
              return callback(err, lockinfo);
            });
          } else {
            return typeof callback === "function" ? callback(null) : void 0;
          }
        }, this));
        this.bind('unlock', __bind(function(model, callback) {
          log('model unlock ' + this.id);
          if (model.id) {
            return this.socket.emit('unlock', {
              id: model.id
            });
          }
        }, this));
      }
      Model.__super__.constructor.apply(this, arguments);
    }
    Model.prototype.emitCommand = function(name, args, callback) {
      var socket, _ref2;
      socket = this.socket || ((_ref2 = this.collection) != null ? _ref2.socket : void 0);
      if (!socket) {
        return typeof callback === "function" ? callback('model is not connected') : void 0;
      }
      return socket.emit('command', name, args, callback);
    };
    Model.prototype.sync = function(method, model, cbo) {
      if (method === 'create' || !this.socket) {
        return this.collection.sync(method, this, cbo);
      }
      log('Model.sync = ' + method + ': id = ' + this.id);
      return this.socket.emit(method, this.toJSON(), __bind(function(error, data, lockinfo) {
        log('Model sync result: ' + error);
        if (error === null) {
          cbo.success(data);
          if (method === 'read') {
            return this.setLockInfo(lockinfo, this.socket.socket.sessionid);
          }
        } else {
          cbo.error();
          if (status === 'moderating') {
            return this.trigger('moderating', this, data);
          }
        }
      }, this));
    };
    return Model;
  })();
  Collection = (function() {
    __extends(Collection, Backbone.Collection);
    function Collection(models, options) {
      this.sync = __bind(this.sync, this);
      var url;
      url = options.url || this.url;
      delete options.url;
      this.socket = io.connect(url);
      this.socket.on('disconnect', __bind(function() {
        log('disconnected from server');
        return this.trigger('disconnected');
      }, this));
      this.socket.on('create', __bind(function(data) {
        var id, model;
        log('collection.add');
        id = data.__id || data[Backbone.Model.prototype.idAttr];
        if (id) {
          log('add -> already exists -> updating ');
          model = this.get(id);
          delete data.__id;
          if (model) {
            return model.set(data);
          }
        }
        return this.add(data);
      }, this));
      this.socket.on('update', __bind(function(data) {
        var id, model;
        id = data[Backbone.Model.prototype.idAttr];
        log('collection.update, id: ' + id);
        if (id) {
          model = this.get(id);
        }
        if (model) {
          return model.set(data);
        }
      }, this));
      this.socket.on('delete', __bind(function(data) {
        var id, model;
        id = data[Backbone.Model.prototype.idAttr];
        log('collection.remove, id: ' + id);
        if (id) {
          model = this.get(id);
        }
        if (model) {
          return this.remove(model);
        }
      }, this));
      this.socket.on('lock', __bind(function(locks, user) {
        if (locks.__sid === this.socket.socket.sessionid) {
          return;
        }
        if (!_.isArray(locks)) {
          locks = [locks];
        }
        return _.each(locks, __bind(function(lockinfo) {
          var id, model;
          id = lockinfo != null ? lockinfo.id : void 0;
          if (!id) {
            return false;
          }
          log('Lock request for ' + id);
          model = this.get(id);
          if (model) {
            return model.serverLock(user);
          }
        }, this));
      }, this));
      this.socket.on('unlock', __bind(function(locks) {
        if (locks.__sid === this.socket.socket.sessionid) {
          return;
        }
        if (!_.isArray(locks)) {
          locks = [locks];
        }
        return _.each(locks, __bind(function(lockinfo) {
          var id, model;
          id = lockinfo != null ? lockinfo.id : void 0;
          if (!id) {
            return false;
          }
          log('Unlock request for ' + id);
          if (id) {
            model = this.get(id);
          }
          if (model) {
            return model.serverUnlock();
          }
        }, this));
      }, this));
      this.socket.on('rejected', __bind(function(modinfo) {
        var id, model;
        log('rejected: ' + modinfo.id);
        id = modinfo.id;
        if (id) {
          model = this.get(id);
        }
        model.unset('moderating');
        return model.trigger('rejected', model, modinfo);
      }, this));
      this.bind('lock', __bind(function(model, callback) {
        if (!model) {
          return false;
        }
        log('Collection lock: ' + model.id);
        if (model.id) {
          return this.socket.emit('lock', {
            id: model.id
          }, callback);
        } else {
          return typeof callback === "function" ? callback(null) : void 0;
        }
      }, this));
      this.bind('unlock', __bind(function(model) {
        log('Collection unlock: ' + model.id);
        if (model.id) {
          return this.socket.emit('unlock', {
            id: model.id
          });
        }
      }, this));
      Collection.__super__.constructor.apply(this, arguments);
    }
    Collection.prototype.sync = function(method, model, cbo) {
      var json;
      json = model.toJSON();
      log('Sync: method= ' + method + ' : model id = ' + model.id);
      return this.socket.emit(method, json, function(status, data) {
        log('Sync result: status=' + status + '; data.__id = ' + (data != null ? data.__id : void 0));
        if (status === null || (status === 'moderating' && method === 'create')) {
          return cbo.success(data);
        } else {
          cbo.error(model);
          if (status === 'moderating') {
            return model.trigger('moderating', model, data);
          }
        }
      });
    };
    return Collection;
  })();
  BackboneSync = Backbone.sync;
  Backbone.sync = function(method, model, cbo) {
    var sync, _ref2;
    sync = model.sync || ((_ref2 = model.collection) != null ? _ref2.sync : void 0) || BackboneSync;
    return typeof sync === "function" ? sync(method, model, cbo) : void 0;
  };
  exports.LockableModel = LockableModel;
  exports.Model = Model;
  exports.Collection = Collection;
}).call(this);
