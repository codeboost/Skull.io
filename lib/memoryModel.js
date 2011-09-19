(function() {
  var MemoryModel, _;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  _ = require('underscore');
  module.exports = MemoryModel = (function() {
    __extends(MemoryModel, require('./serverSkull').Model);
    function MemoryModel() {
      this.items = {};
      this.id = 9938;
      MemoryModel.__super__.constructor.call(this);
    }
    MemoryModel.prototype.read = function(filter, callback) {
      return typeof callback === "function" ? callback(null, _.toArray(this.items)) : void 0;
    };
    MemoryModel.prototype.create = function(items, callback) {
      var list;
      if (_.isArray(items)) {
        list = items;
      } else {
        list = [items];
      }
      _.each(list, __bind(function(data) {
        var id;
        id = data.id || this.id++;
        data.id = id;
        return this.items[id] = data;
      }, this));
      if (typeof callback === "function") {
        callback(null, items);
      }
      return this.emit("create", items);
    };
    MemoryModel.prototype.update = function(data, callback) {
      if (this.items[data.id]) {
        _.each(data, __bind(function(value, key) {
          return this.items[data.id][key] = value;
        }, this));
        if (typeof callback === "function") {
          callback(null, data);
        }
        return this.emit("update", data);
      } else {
        return typeof callback === "function" ? callback("error", data) : void 0;
      }
    };
    MemoryModel.prototype["delete"] = function(data, callback) {
      if (this.items[data.id]) {
        delete this.items[data.id];
        if (typeof callback === "function") {
          callback(null, data);
        }
        return this.emit("delete", data);
      } else {
        return typeof callback === "function" ? callback("error", data) : void 0;
      }
    };
    return MemoryModel;
  })();
}).call(this);
